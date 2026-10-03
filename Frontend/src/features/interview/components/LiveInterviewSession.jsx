import React, { useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import {
  Video,
  MessageSquareText,
  Sparkles,
  PhoneOff,
  X,
  Send,
  RotateCcw,
} from 'lucide-react'
import { useAuth } from '../../auth/hooks/useAuth.js'

const getStoredToken = () => {
  if (typeof document === 'undefined') return null

  const tokenCookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('token='))

  if (tokenCookie) {
    return decodeURIComponent(tokenCookie.split('=').slice(1).join('='))
  }

  return localStorage.getItem('auth_token') || null
}

const normalizeFeedback = (feedback) => {
  if (!feedback || typeof feedback !== 'object') {
    return {
      score: 0,
      summary: 'The interview has concluded. Review your transcript and continue refining your answers.',
      strengths: ['Stay confident and explain your decisions clearly.'],
      improvements: ['Practice structured examples and tighten your technical depth.'],
    }
  }

  const score = Number(feedback.matchScore ?? feedback.score ?? feedback.overallScore ?? 0)

  const summary = feedback.summary
    ?? feedback.transcriptSummary
    ?? feedback.overview
    ?? 'The mock interview was completed successfully.'

  const strengths = Array.isArray(feedback.strengths)
    ? feedback.strengths
    : typeof feedback.strengths === 'string'
      ? feedback.strengths.split(/\n|\r|\u2022|;/).map((item) => item.trim()).filter(Boolean)
      : ['Clear communication and structured thinking.']

  const improvements = Array.isArray(feedback.areasForImprovement)
    ? feedback.areasForImprovement
    : Array.isArray(feedback.improvements)
      ? feedback.improvements
      : typeof feedback.areasForImprovement === 'string'
        ? feedback.areasForImprovement.split(/\n|\r|\u2022|;/).map((item) => item.trim()).filter(Boolean)
        : ['Increase depth in system design and behavioral examples.']

  return {
    score: Number.isFinite(score) ? score : 0,
    summary,
    strengths: strengths.length ? strengths : ['Clear communication and structured thinking.'],
    improvements: improvements.length ? improvements : ['Increase depth in system design and behavioral examples.'],
  }
}

const LiveInterviewSession = ({ interviewReportId, report, onClose }) => {
  const { token } = useAuth()
  const socketRef = useRef(null)
  const [isInterviewEnded, setIsInterviewEnded] = useState(false)
  const [statusText, setStatusText] = useState('Connecting to your AI interviewer...')
  const [messages, setMessages] = useState([
    { id: 'welcome', speaker: 'System', text: 'Your text interview is ready. Answer each question below and the interviewer will continue.' },
  ])
  const [chatInput, setChatInput] = useState('')
  const [error, setError] = useState('')
  const [sessionError, setSessionError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const activeToken = useMemo(() => token || getStoredToken(), [token])
  const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'
  const isSessionReady = Boolean(interviewReportId) && Boolean(activeToken)
  const guardError = !interviewReportId
    ? 'No interview report is available to join this session.'
    : !activeToken
      ? 'Please log in again to access the live mock interview. This session requires a valid auth token.'
      : ''

  const appendMessage = (speaker, text) => {
    if (!text || !text.trim()) return

    setMessages((current) => [
      ...current,
      {
        id: `${speaker}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        speaker,
        text: String(text).trim(),
      },
    ])
  }

  useEffect(() => {
    if (!isSessionReady) {
      return undefined
    }

    const socket = io(socketBaseUrl, {
      auth: { token: activeToken },
      transports: ['websocket'],
      reconnection: true,
      withCredentials: true,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setError('')
      setIsProcessing(true)
      setStatusText('AI interviewer is ready. Read the question and type your answer.')
      socket.emit('start-interview', { interviewReportId })
    })

    socket.on('interview-started', () => {
      setStatusText('Interview started. Answer the question below.')
      appendMessage('System', 'Interview started successfully. Please type your answer below.')
    })

    socket.on('text-response', ({ text }) => {
      setIsProcessing(false)
      setSessionError('')
      appendMessage('AI', text)
    })
    socket.on('text-message', ({ text }) => appendMessage('Candidate', text))
    socket.on('generating-feedback', ({ message }) => {
      setStatusText(message || 'Generating your interview feedback...')
      appendMessage('System', message || 'Generating your assessment...')
    })

    socket.on('interview-ended', ({ feedback: serverFeedback }) => {
      setIsProcessing(false)
      setIsInterviewEnded(true)
      const nextFeedback = normalizeFeedback(serverFeedback ?? report)
      setFeedback(nextFeedback)
      setStatusText('Interview complete. Review your evaluation report below.')
      appendMessage('System', 'The mock interview has ended. Your evaluation is ready.')
    })

    socket.on('error', ({ message }) => {
      setIsProcessing(false)
      setError(message || 'The live interview encountered an error.')
      setStatusText('The interview request could not be completed. You can try again.')
    })

    const handleSessionError = ({ message } = {}) => {
      setIsProcessing(false)
      setSessionError(message || 'We could not generate the next question. Please try again.')
      setStatusText('The interviewer hit a temporary issue. Your answer has been saved.')
    }
    socket.on('session-error', handleSessionError)

    socket.on('disconnect', () => {
      if (!isInterviewEnded) {
        setStatusText('Connection lost. Your session may need to be restarted.')
      }
    })

    return () => {
      socket.off('session-error', handleSessionError)
      socket.disconnect()
      socketRef.current = null
    }
  }, [activeToken, interviewReportId, isInterviewEnded, report])

  const handleSendText = () => {
    const trimmedText = chatInput.trim()

    if (!trimmedText || !socketRef.current) {
      return
    }

    socketRef.current.emit('text-message', { text: trimmedText })
    appendMessage('Candidate', trimmedText)
    setChatInput('')
    setIsProcessing(true)
    setStatusText('Answer sent. Waiting for the next question...')
  }

  const handleRetryQuestion = () => {
    if (!socketRef.current || isProcessing) return

    setSessionError('')
    setIsProcessing(true)
    setStatusText('Retrying question generation...')
    socketRef.current.emit('retry-question')
  }

  const handleEndInterview = () => {
    if (socketRef.current) {
      socketRef.current.emit('end-interview')
    }
    setStatusText('Ending interview and generating your feedback report...')
  }

  const matchScore = feedback?.score ?? report?.matchScore ?? 0

  return (
    <section className='live-interview-panel'>
      <div className='live-interview-panel__header'>
        <div className='live-interview-panel__title-group'>
          <span className='live-interview-panel__icon'><Video size={18} /></span>
          <div>
            <h2>Live Mock Interview</h2>
            <p>{statusText}</p>
          </div>
        </div>

        <button type='button' className='live-interview-panel__close' onClick={onClose} aria-label='Close live interview'>
          <X size={16} />
        </button>
      </div>

      {(error || guardError) && <div className='live-interview-panel__error'>{error || guardError}</div>}

      {sessionError && (
        <div className='live-interview-panel__modal-backdrop'>
          <div className='live-interview-panel__error-modal' role='alertdialog' aria-modal='true' aria-labelledby='session-error-title' aria-describedby='session-error-message'>
            <button type='button' className='live-interview-panel__modal-close' onClick={() => setSessionError('')} aria-label='Dismiss error'>
              <X size={16} />
            </button>
            <h3 id='session-error-title'>Question unavailable</h3>
            <p id='session-error-message'>{sessionError}</p>
            <button type='button' className='live-interview-panel__retry-button' onClick={handleRetryQuestion} disabled={isProcessing}>
              <RotateCcw size={16} />
              Retry
            </button>
          </div>
        </div>
      )}

      <div className='live-interview-panel__controls'>
        <button type='button' className='live-interview-panel__button live-interview-panel__button--danger' onClick={handleEndInterview} disabled={isInterviewEnded}>
          <PhoneOff size={16} />
          End Interview
        </button>
      </div>

      {isInterviewEnded && feedback ? (
        <div className='live-interview-panel__report'>
          <div className='live-interview-panel__report-header'>
            <div>
              <span className='live-interview-panel__eyebrow'>Post-interview evaluation</span>
              <h3>Interview Summary</h3>
            </div>
            <div className='live-interview-panel__score'>
              <span>{Math.round(matchScore)}</span>
              <small>%</small>
            </div>
          </div>

          <div className='live-interview-panel__report-card'>
            <div>
              <p className='live-interview-panel__label'>Transcript Summary</p>
              <p>{feedback.summary}</p>
            </div>

            <div>
              <p className='live-interview-panel__label'>Strengths</p>
              <ul>
                {feedback.strengths.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>

            <div>
              <p className='live-interview-panel__label'>Areas for Improvement</p>
              <ul>
                {feedback.improvements.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className='live-interview-panel__transcript'>
            <div className='live-interview-panel__transcript-header'>
              <span className='live-interview-panel__eyebrow'>Live Transcript</span>
              <div className='live-interview-panel__live-indicator'>
                <Sparkles size={12} />
                Live
              </div>
            </div>

            <div className='live-interview-panel__messages'>
              {messages.map((message) => (
                <div key={message.id} className={`live-interview-panel__message live-interview-panel__message--${message.speaker.toLowerCase()}`}>
                  <span>{message.speaker}</span>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className='live-interview-panel__chat'>
            <div className='live-interview-panel__chat-header'>
              <MessageSquareText size={16} />
              <span>Quick message</span>
            </div>

            <div className='live-interview-panel__chat-input-row'>
              <input
                type='text'
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleSendText()
                  }
                }}
                placeholder='Type your answer here'
                disabled={isProcessing}
              />
              <button type='button' onClick={handleSendText} aria-label='Send answer' disabled={isProcessing}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      <div className='live-interview-panel__status'>
        <span>{isSessionReady ? statusText : 'Waiting for a valid session and auth token...'}</span>
      </div>
    </section>
  )
}

export default LiveInterviewSession
