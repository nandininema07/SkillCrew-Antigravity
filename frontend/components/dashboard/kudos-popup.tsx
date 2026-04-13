'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Award, Zap, Star, Trophy } from 'lucide-react'

export interface KudosMessage {
  id: string
  type: 'correct_answer' | 'perfect_score' | 'deep_dive_added' | 'skill_mastered'
  title: string
  message: string
  xpEarned?: number
  pointsEarned?: number
  icon?: React.ReactNode
  color?: string
}

interface KudosPopupProps {
  message: KudosMessage
  isVisible: boolean
  onDismiss: () => void
  autoHideDuration?: number
}

interface KudosQueueProps {
  messages: KudosMessage[]
}

const getKudosConfig = (type: KudosMessage['type']) => {
  switch (type) {
    case 'correct_answer':
      return {
        icon: <Star className="w-8 h-8" />,
        bgGradient: 'from-green-400 to-green-600',
        textColor: 'text-white',
        accentColor: 'bg-green-500',
      }
    case 'perfect_score':
      return {
        icon: <Trophy className="w-8 h-8" />,
        bgGradient: 'from-yellow-400 to-orange-600',
        textColor: 'text-white',
        accentColor: 'bg-yellow-500',
      }
    case 'deep_dive_added':
      return {
        icon: <Zap className="w-8 h-8" />,
        bgGradient: 'from-blue-400 to-indigo-600',
        textColor: 'text-white',
        accentColor: 'bg-blue-500',
      }
    case 'skill_mastered':
      return {
        icon: <Award className="w-8 h-8" />,
        bgGradient: 'from-purple-400 to-pink-600',
        textColor: 'text-white',
        accentColor: 'bg-purple-500',
      }
    default:
      return {
        icon: <Star className="w-8 h-8" />,
        bgGradient: 'from-blue-400 to-blue-600',
        textColor: 'text-white',
        accentColor: 'bg-blue-500',
      }
  }
}

export const KudosPopup: React.FC<KudosPopupProps> = ({
  message,
  isVisible,
  onDismiss,
  autoHideDuration = 3000,
}) => {
  const config = getKudosConfig(message.type)

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onDismiss()
      }, autoHideDuration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, autoHideDuration, onDismiss])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.8 }}
          className="fixed top-20 right-6 z-50"
        >
          <div className={`bg-gradient-to-r ${config.bgGradient} rounded-xl shadow-2xl overflow-hidden ${config.textColor} p-6 max-w-sm`}>
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-white mix-blend-overlay" />
            </div>

            <div className="relative">
              {/* Icon and Title */}
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="flex-shrink-0"
                >
                  {message.icon || config.icon}
                </motion.div>
                <h3 className="font-bold text-lg">{message.title}</h3>
              </div>

              {/* Message */}
              <p className="text-sm opacity-90 mb-4">{message.message}</p>

              {/* XP/Points Display */}
              <div className="flex gap-2">
                {message.xpEarned && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`${config.accentColor} px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1`}
                  >
                    <Zap className="w-3 h-3" />
                    +{message.xpEarned} XP
                  </motion.div>
                )}
                {message.pointsEarned && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className={`${config.accentColor} px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1`}
                  >
                    <Star className="w-3 h-3" />
                    +{message.pointsEarned} pts
                  </motion.div>
                )}
              </div>

              {/* Confetti effects */}
              <Confetti />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface ConfettiPieceProps {
  delay: number
}

const ConfettiPiece: React.FC<ConfettiPieceProps> = ({ delay }) => {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, x: 0 }}
      animate={{
        opacity: 0,
        y: 100,
        x: (Math.random() - 0.5) * 200,
        rotate: Math.random() * 360,
      }}
      transition={{
        duration: 2,
        delay,
        ease: 'easeOut',
      }}
      className={`absolute pointer-events-none ${
        Math.random() > 0.5 ? 'bg-white' : 'bg-yellow-300'
      } rounded-full`}
      style={{
        width: Math.random() * 8 + 4,
        height: Math.random() * 8 + 4,
        left: `${Math.random() * 100}%`,
        top: 0,
      }}
    />
  )
}

const Confetti: React.FC = () => {
  return (
    <>
      {[...Array(12)].map((_, i) => (
        <ConfettiPiece key={i} delay={i * 0.05} />
      ))}
    </>
  )
}

export const KudosQueue: React.FC<KudosQueueProps> = ({ messages }) => {
  const [visibleIndex, setVisibleIndex] = useState(0)

  useEffect(() => {
    if (visibleIndex < messages.length) {
      const timer = setTimeout(() => {
        setVisibleIndex(visibleIndex + 1)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [visibleIndex, messages.length])

  return (
    <AnimatePresence>
      {visibleIndex < messages.length && (
        <KudosPopup
          key={messages[visibleIndex].id}
          message={messages[visibleIndex]}
          isVisible={true}
          onDismiss={() => setVisibleIndex(visibleIndex + 1)}
        />
      )}
    </AnimatePresence>
  )
}
