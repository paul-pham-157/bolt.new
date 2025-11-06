import { useState } from 'react';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usePromptEnhancement');

export function usePromptEnhancer() {
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [promptEnhanced, setPromptEnhanced] = useState(false);

  const resetEnhancer = () => {
    setEnhancingPrompt(false);
    setPromptEnhanced(false);
  };

  const enhancePrompt = async (input: string, setInput: (value: string) => void) => {
    setEnhancingPrompt(true);
    setPromptEnhanced(false);

    const originalInput = input;

    try {
      const response = await fetch('/api/enhancer', {
        method: 'POST',
        body: JSON.stringify({
          message: input,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();

      if (reader) {
        const decoder = new TextDecoder();

        let _input = '';

        try {
          setInput('');

          while (true) {
            const { value, done } = await reader.read();

            if (done) {
              break;
            }

            _input += decoder.decode(value);

            logger.trace('Set input', _input);

            setInput(_input);
          }
        } catch (error) {
          logger.error('Failed to read enhanced prompt stream:', error);
          setInput(originalInput);
        }
      }
    } catch (error) {
      logger.error('Failed to enhance prompt:', error);
      setInput(originalInput);
    } finally {
      setEnhancingPrompt(false);
      setPromptEnhanced(true);
    }
  };

  return { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer };
}
