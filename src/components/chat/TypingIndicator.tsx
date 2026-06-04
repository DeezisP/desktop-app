import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  names: string[]
}

export function TypingIndicator({ names }: Props) {
  const visible = names.length > 0
  const label =
    names.length === 1
      ? `${names[0]} กำลังพิมพ์...`
      : names.length === 2
        ? `${names[0]} และ ${names[1]} กำลังพิมพ์...`
        : 'หลายคนกำลังพิมพ์...'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="typing"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 px-4 py-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 select-none"
        >
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="block w-1 h-1 rounded-full bg-zinc-400 dark:bg-zinc-500"
                animate={{ y: [0, -3, 0] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </span>
          <span>{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
