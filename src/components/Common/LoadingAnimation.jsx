import { motion } from 'framer-motion';

const LoadingAnimation = ({ message = 'Loading...', size = 'default' }) => {
  const textSizes = {
    small: 'text-xs',
    default: 'text-sm',
    large: 'text-base'
  };

  const containerPadding = {
    small: 'p-2',
    default: 'p-6',
    large: 'p-8'
  };

  const containerGap = {
    small: 'gap-2',
    default: 'gap-4',
    large: 'gap-6'
  };

  const spinnerSizes = {
    small: 'w-4 h-4',
    default: 'w-12 h-12',
    large: 'w-16 h-16'
  };

  // For small size, show simple spinner
  if (size === 'small') {
    return (
      <div className="flex items-center gap-2">
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
          className={`${spinnerSizes[size]} border-2 border-primary-500 border-t-transparent rounded-full`}
        />
        {message && (
          <span className={`${textSizes[size]} text-text`}>{message}</span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${containerGap[size]} ${containerPadding[size]}`}>
      {/* Simple Spinner */}
      <motion.div
        className={`${spinnerSizes[size]} border-4 border-primary-500/20 border-t-primary-500 rounded-full`}
        animate={{
          rotate: 360,
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Loading Text */}
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className={`${textSizes[size]} font-medium text-text`}>
          {message}
        </span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className={`${textSizes[size]} text-primary-500 font-bold`}
              animate={{
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut"
              }}
            >
              .
            </motion.span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default LoadingAnimation;
