'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, XCircle, Clock, Zap } from 'lucide-react'

export interface QuizQuestion {
  id: string
  question_text: string
  options: string[]
  correct_answer_index: number
  explanation: string
  skill: string
  difficulty: string
}

export interface CodingQuestion {
  id: string
  problem_description: string
  starter_code: string
  test_cases: Array<{ input: Record<string, any>; expected_output: string }>
  rubric: Record<string, number>
  skill: string
  difficulty: string
}

export interface DebuggingQuestion {
  id: string
  description: string
  buggy_code: string
  test_cases: Array<{ input: Record<string, any>; expected_output: string }>
  expected_fixed_code: string
  skill: string
  difficulty: string
}

type Question = QuizQuestion | CodingQuestion | DebuggingQuestion

interface AssessmentViewerProps {
  assessmentId: string
  assessmentType: 'quiz' | 'coding_test' | 'debugging_test'
  difficulty: 'easy' | 'medium' | 'hard'
  questions: Question[]
  onAnswerSubmit: (questionId: string, answer: string) => Promise<void>
  onAssessmentComplete: (responses: Array<{ questionId: string; answer: string }>) => Promise<void>
}

interface QuestionState {
  questionId: string
  answer: string
  submitted: boolean
  feedback?: {
    isCorrect: boolean
    pointsEarned: number
    maxPoints: number
    explanation?: string
  }
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'easy':
      return 'bg-green-100 text-green-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'hard':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const AssessmentViewer: React.FC<AssessmentViewerProps> = ({
  assessmentId,
  assessmentType,
  difficulty,
  questions,
  onAnswerSubmit,
  onAssessmentComplete,
}) => {
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>({})
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false)
  const [isSubmittingAssessment, setIsSubmittingAssessment] = useState(false)
  const [startTime] = useState(new Date())

  const currentQuestion = questions[currentQuestionIdx]
  const currentState = questionStates[currentQuestion.id] || {
    questionId: currentQuestion.id,
    answer: '',
    submitted: false,
  }

  const handleAnswerChange = (answer: string) => {
    setQuestionStates(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        questionId: currentQuestion.id,
        answer,
        submitted: false,
      },
    }))
  }

  const handleSubmitAnswer = async () => {
    if (!currentState.answer.trim()) {
      alert('Please provide an answer before submitting')
      return
    }

    setIsSubmittingAnswer(true)
    try {
      await onAnswerSubmit(currentQuestion.id, currentState.answer)

      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...prev[currentQuestion.id],
          submitted: true,
          feedback: {
            isCorrect: Math.random() > 0.3, // Placeholder
            pointsEarned: Math.random() > 0.3 ? 10 : 0,
            maxPoints: 10,
            explanation: (currentQuestion as QuizQuestion).explanation,
          },
        },
      }))
    } catch (error) {
      console.error('Error submitting answer:', error)
    } finally {
      setIsSubmittingAnswer(false)
    }
  }

  const handleCompleteAssessment = async () => {
    const responses = Object.values(questionStates).map(state => ({
      questionId: state.questionId,
      answer: state.answer,
    }))

    setIsSubmittingAssessment(true)
    try {
      await onAssessmentComplete(responses)
    } catch (error) {
      console.error('Error completing assessment:', error)
    } finally {
      setIsSubmittingAssessment(false)
    }
  }

  const isQuizQuestion = (q: Question): q is QuizQuestion => 'options' in q
  const isCodingQuestion = (q: Question): q is CodingQuestion => 'starter_code' in q
  const isDebuggingQuestion = (q: Question): q is DebuggingQuestion => 'buggy_code' in q

  const completedCount = Object.values(questionStates).filter(s => s.submitted).length

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Assessment Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl capitalize">
                {assessmentType.replace(/_/g, ' ')}
              </CardTitle>
              <CardDescription className="mt-2">
                Question {currentQuestionIdx + 1} of {questions.length}
              </CardDescription>
            </div>
            <div className="text-right space-y-2">
              <Badge className={`${getDifficultyColor(difficulty)}`}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Level
              </Badge>
              <div className="text-sm text-gray-600 font-medium">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {completedCount}/{questions.length} answered
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Progress</span>
          <span>{Math.round((completedCount / questions.length) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / questions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-lg">
              {isQuizQuestion(currentQuestion) && 'Question: '}
              {currentQuestion.question_text || (currentQuestion as CodingQuestion).problem_description || (currentQuestion as DebuggingQuestion).description}
            </CardTitle>
            <Badge variant="outline">Skill: {currentQuestion.skill}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Quiz Questions */}
          {isQuizQuestion(currentQuestion) && (
            <div className="space-y-4">
              <RadioGroup value={currentState.answer} onValueChange={handleAnswerChange}>
                {currentQuestion.options.map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <RadioGroupItem value={idx.toString()} id={`option-${idx}`} />
                    <Label
                      htmlFor={`option-${idx}`}
                      className="cursor-pointer flex-1 p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Coding Question */}
          {isCodingQuestion(currentQuestion) && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Starter Code:</p>
                <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                  <code>{currentQuestion.starter_code}</code>
                </pre>
              </div>

              <div>
                <Label htmlFor={`code-answer-${currentQuestion.id}`} className="text-sm font-medium mb-2 block">
                  Your Solution:
                </Label>
                <Textarea
                  id={`code-answer-${currentQuestion.id}`}
                  placeholder="Write your Python code here..."
                  className="font-mono h-64"
                  value={currentState.answer}
                  onChange={e => handleAnswerChange(e.target.value)}
                />
              </div>

              <details className="border rounded-lg p-3">
                <summary className="font-medium cursor-pointer">Test Cases</summary>
                <div className="mt-3 space-y-2">
                  {currentQuestion.test_cases.map((tc, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded text-xs font-mono">
                      <div>Input: {JSON.stringify(tc.input)}</div>
                      <div>Expected: {tc.expected_output}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Debugging Question */}
          {isDebuggingQuestion(currentQuestion) && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm font-medium text-red-900 mb-2">Buggy Code:</p>
                <pre className="bg-white p-3 rounded text-sm overflow-auto">
                  <code className="text-red-700">{currentQuestion.buggy_code}</code>
                </pre>
              </div>

              <div>
                <Label htmlFor={`debug-answer-${currentQuestion.id}`} className="text-sm font-medium mb-2 block">
                  Fixed Code:
                </Label>
                <Textarea
                  id={`debug-answer-${currentQuestion.id}`}
                  placeholder="Write your fixed Python code here..."
                  className="font-mono h-64"
                  value={currentState.answer}
                  onChange={e => handleAnswerChange(e.target.value)}
                />
              </div>

              <details className="border rounded-lg p-3">
                <summary className="font-medium cursor-pointer">Test Cases</summary>
                <div className="mt-3 space-y-2">
                  {currentQuestion.test_cases.map((tc, idx) => (
                    <div key={idx} className="bg-gray-50 p-2 rounded text-xs font-mono">
                      <div>Input: {JSON.stringify(tc.input)}</div>
                      <div>Expected: {tc.expected_output}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* Feedback (if submitted) */}
          {currentState.submitted && currentState.feedback && (
            <div
              className={`p-4 rounded-lg border-2 ${
                currentState.feedback.isCorrect
                  ? 'border-green-300 bg-green-50'
                  : 'border-red-300 bg-red-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {currentState.feedback.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      currentState.feedback.isCorrect ? 'text-green-900' : 'text-red-900'
                    }`}
                  >
                    {currentState.feedback.isCorrect ? 'Correct!' : 'Incorrect'} 
                    {' '}({currentState.feedback.pointsEarned}/{currentState.feedback.maxPoints} points)
                  </p>
                  {currentState.feedback.explanation && (
                    <p className={`text-sm mt-2 ${
                      currentState.feedback.isCorrect ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {currentState.feedback.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex gap-3 justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
          disabled={currentQuestionIdx === 0}
        >
          Previous Question
        </Button>

        {!currentState.submitted ? (
          <Button
            onClick={handleSubmitAnswer}
            disabled={isSubmittingAnswer || !currentState.answer.trim()}
            className="flex-1"
          >
            {isSubmittingAnswer ? 'Submitting...' : 'Submit Answer'}
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => handleAnswerChange('')}
            className="flex-1"
          >
            Change Answer
          </Button>
        )}

        {currentQuestionIdx < questions.length - 1 ? (
          <Button
            onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
            disabled={!currentState.submitted}
          >
            Next Question
          </Button>
        ) : (
          <Button
            onClick={handleCompleteAssessment}
            disabled={completedCount < questions.length || isSubmittingAssessment}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmittingAssessment ? 'Completing...' : 'Complete Assessment'}
          </Button>
        )}
      </div>
    </div>
  )
}
