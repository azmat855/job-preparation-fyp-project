const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const interviewReportModel = require("../models/interviewReport.model")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})


 

// Configurable threshold limits for question counts
const QUESTION_LIMITS = [
    { minWords: 330, questions: 15 },
    { minWords: 240, questions: 13 },
    { minWords: 200, questions: 10 },
    { minWords: 150, questions: 9 },
    { minWords: 80,  questions: 7 }
]
const DEFAULT_QUESTION_COUNT = 5

function getGeminiErrorMessage(error) {
    let providerError = error
    const rawMessage = error?.message

    if (typeof rawMessage === "string") {
        try {
            providerError = JSON.parse(rawMessage)?.error || error
        } catch {
            providerError = error
        }
    }

    const details = String(providerError?.message || rawMessage || error)
    const errorCode = String(providerError?.code || error?.code || "")
    const errorStatus = String(providerError?.status || error?.status || "")
    const errorSummary = `${errorCode} ${errorStatus} ${details}`

    if (/429|RESOURCE_EXHAUSTED|quota/i.test(errorSummary)) {
        return "The AI service has reached its request limit. Please wait before retrying."
    }

    if (/404|NOT_FOUND|model.*(not found|unavailable)/i.test(errorSummary)) {
        return "The configured Gemini model is unavailable. Please check GEMINI_MODEL setting."
    }

    if (/401|403|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID/i.test(errorSummary)) {
        return "Gemini API authentication failed. Check GOOGLE_GENAI_API_KEY settings."
    }

    const safeDetails = details
        .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
        .replace(/https?:\/\/\S+/g, "[link]")
        .slice(0, 240)

    return safeDetails
        ? `Gemini request failed: ${safeDetails}`
        : "The AI service could not complete that request. Please try again shortly."
}

const feedbackSchema = z.object({
    matchScore: z.number().int().min(0).max(100),
    summary: z.string().nonempty(),
    strengths: z.array(z.string()).min(1),
    areasForImprovement: z.array(z.string()).min(1)
})

const rawJsonSchema = zodToJsonSchema(feedbackSchema, { target: "openApi3" })

class ProductionInterviewSession {
    constructor(socket, reportData) {
        this.socket = socket
        this.reportData = reportData
        this.transcriptHistory = []
        this.questionCount = 0
        this.isProcessing = false
        this.maxQuestions = this.calculateQuestionsFromJD(reportData?.jobDescription)
    }

    calculateQuestionsFromJD(jobDescription) {
        if (!jobDescription || typeof jobDescription !== 'string') return DEFAULT_QUESTION_COUNT
        const wordCount = jobDescription.trim().split(/\s+/).length

        for (const limit of QUESTION_LIMITS) {
            if (wordCount > limit.minWords) return limit.questions
        }
        return DEFAULT_QUESTION_COUNT
    }

    async init() {
        await this.generateAndAskNextQuestion()
    }

    async generateAndAskNextQuestion() {
        if (this.isProcessing) return
        this.isProcessing = true

        try {
            if (this.questionCount >= this.maxQuestions) {
                this.socket.emit("text-response", {
                    text: "You have completed all questions. Click End Interview to receive your feedback.",
                    isFinished: true
                })
                return
            }

            this.questionCount += 1

            // Increased window size to 12 to preserve recent technical dialogue context
            const recentHistory = this.transcriptHistory.slice(-12).join("\n")

            const roleTitle = this.reportData?.title || 'Target Role'
            const jobDesc = this.reportData?.jobDescription || 'Not specified'

            const systemInstruction = `You are an expert technical interviewer conducting a live mock interview.
Role Title: ${roleTitle}
Job Description: ${jobDesc}

RULES:
1. Ask clear, scenario-based technical questions matching the Candidate Resume and Job Description.
2. Ask Question #${this.questionCount} of ${this.maxQuestions}.
3. Do NOT repeat previous topics or questions.
4. Output ONLY the question string directly. No conversational filler.`

            const prompt = `Candidate Resume Summary: ${this.reportData?.resume || 'Provided in JD'}
Interview Transcript So Far:
${recentHistory || 'Interview started.'}

Ask the next question.`

            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    temperature: 0.6,
                }
            })

            const question = response.text ? response.text.trim() : null

            if (!question) {
                throw new Error("Empty response received from Gemini API.")
            }
            
            this.transcriptHistory.push(`AI: ${question}`)
            this.socket.emit("text-response", { 
                text: question, 
                questionNumber: this.questionCount 
            })

        } catch (error) {
            console.error(`[Session ${this.reportData?._id}] Gemini API Failure:`, error?.message || error)

            // Rollback question count on error
            this.questionCount -= 1 

            this.socket.emit("session-error", {
                message: getGeminiErrorMessage(error),
                error: error?.message || "Gemini API Error"
            })

        } finally {
            this.isProcessing = false
        }
    }

    async sendTextMessage(text) {
        const answer = text?.trim()
        if (!answer || this.isProcessing) return

        this.transcriptHistory.push(`Candidate: ${answer}`)
        await this.generateAndAskNextQuestion()
    }

    async generateFinalFeedback() {
        const transcript = this.transcriptHistory.join("\n")

        if (!transcript.trim()) {
            throw new Error("Cannot generate feedback for an empty transcript.")
        }

        const roleTitle = this.reportData?.title || 'Target Role'
        const jobDesc = this.reportData?.jobDescription || 'Not specified'

        const systemInstruction = `You are a Principal Software Architect evaluating a candidate's mock interview performance.
Analyze the transcript rigorously against the Job Description and return a structured JSON evaluation.`

        const prompt = `Job Title: ${roleTitle}
Job Description: ${jobDesc}

Interview Transcript:
${transcript}`

        try {
            const response = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: prompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: rawJsonSchema
                }
            })

            const rawJson = JSON.parse(response.text)
            const parsedFeedback = feedbackSchema.safeParse(rawJson)

            if (!parsedFeedback.success) {
                throw new Error(`Zod Schema Validation Error: ${JSON.stringify(parsedFeedback.error.format())}`)
            }

            const feedback = parsedFeedback.data

            // Database Update
            await interviewReportModel.findByIdAndUpdate(
                this.reportData._id,
                {
                    $set: {
                        status: "Completed",
                        transcript: this.transcriptHistory,
                        matchScore: feedback.matchScore,
                        summary: feedback.summary,
                        strengths: feedback.strengths,
                        areasForImprovement: feedback.areasForImprovement,
                        updatedAt: new Date()
                    }
                },
                { returnDocument: 'after' }
            )

            return feedback

        } catch (error) {
            console.error(`[Session ${this.reportData?._id}] Final Feedback Generation Error:`, error?.message || error)
            throw new Error(getGeminiErrorMessage(error))
        }
    }
}

module.exports = ProductionInterviewSession