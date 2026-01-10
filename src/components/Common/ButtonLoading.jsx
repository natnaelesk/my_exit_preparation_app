import { motion } from 'framer-motion';
import { SparklesIcon } from '@heroicons/react/24/outline';

const ButtonLoading = ({ text = 'Loading...' }) => {
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
      >
        <SparklesIcon className="w-4 h-4" />
      </motion.div>
      <span>{text}</span>
    </div>
  );
};

export default ButtonLoading;

