const pdfParseModule = require("pdf-parse")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

async function generateInterViewReportController(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Please upload a resume PDF file." })
        }

        const { selfDescription, jobDescription } = req.body

        if (!jobDescription) {
            return res.status(400).json({ message: "Job description is required." })
        }

        // Safe parser resolution: Handles function, Class, or .default
        let resumeText = ""
        if (typeof pdfParseModule === "function") {
            const data = await pdfParseModule(req.file.buffer)
            resumeText = data.text
        } else if (pdfParseModule.PDFParse) {
            const parser = new pdfParseModule.PDFParse(new Uint8Array(req.file.buffer))
            const result = await parser.getText()
            resumeText = result.text || result
        } else if (typeof pdfParseModule.default === "function") {
            const data = await pdfParseModule.default(req.file.buffer)
            resumeText = data.text
        } else {
            throw new Error("Unable to resolve pdf-parse module format.")
        }

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        return res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })

    } catch (error) {
        console.error("Error generating interview report:", error)
        return res.status(500).json({
            message: "Internal server error while generating interview report.",
            error: error.message
        })
    }
}

async function getInterviewReportByIdController(req, res) {
    try {
        const { interviewId } = req.params
        const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found." })
        }

        return res.status(200).json({
            message: "Interview report fetched successfully.",
            interviewReport
        })
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message })
    }
}

async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel
            .find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .select("title matchScore createdAt updatedAt")

        return res.status(200).json({
            message: "Interview reports fetched successfully.",
            interviewReports
        })
    } catch (error) {
        return res.status(500).json({ message: "Server error", error: error.message })
    }
}

async function generateResumePdfController(req, res) {
    try {
        const { interviewReportId } = req.params
        const interviewReport = await interviewReportModel.findOne({ _id: interviewReportId, user: req.user.id })

        if (!interviewReport) {
            return res.status(404).json({ message: "Interview report not found." })
        }

        const { resume, jobDescription, selfDescription } = interviewReport
        const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
        })

        return res.send(pdfBuffer)
    } catch (error) {
        return res.status(500).json({ message: "PDF generation failed", error: error.message })
    }
}

module.exports = {
    generateInterViewReportController,
    getInterviewReportByIdController,
    getAllInterviewReportsController,
    generateResumePdfController
}