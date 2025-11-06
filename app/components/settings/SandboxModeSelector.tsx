import { memo, useState } from 'react';
import type { SandboxType, SandboxCostEstimate } from '~/lib/sandbox';
import { SandboxFactory } from '~/lib/sandbox';

interface SandboxModeSelectorProps {
  currentMode: SandboxType;
  onModeChange: (mode: SandboxType) => void;
  disabled?: boolean;
}

export const SandboxModeSelector = memo(({ currentMode, onModeChange, disabled }: SandboxModeSelectorProps) => {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingMode, setPendingMode] = useState<SandboxType | null>(null);

  const isE2BAvailable = SandboxFactory.isE2BAvailable();

  const webContainerCost = SandboxFactory.getCostEstimate('webcontainer');
  const e2bCost = SandboxFactory.getCostEstimate('e2b', 60);

  const handleModeSelect = (mode: SandboxType) => {
    if (mode === currentMode) return;

    // If switching to E2B, show confirmation with cost info
    if (mode === 'e2b') {
      setPendingMode(mode);
      setShowConfirmation(true);
    } else {
      onModeChange(mode);
    }
  };

  const confirmModeChange = () => {
    if (pendingMode) {
      onModeChange(pendingMode);
    }
    setShowConfirmation(false);
    setPendingMode(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Selection */}
      <div className="grid grid-cols-2 gap-4">
        {/* WebContainer Mode */}
        <button
          onClick={() => handleModeSelect('webcontainer')}
          disabled={disabled}
          className={`
            flex flex-col p-4 rounded-lg border-2 transition-all
            ${
              currentMode === 'webcontainer'
                ? 'border-bolt-elements-borderColorActive bg-bolt-elements-background-depth-3'
                : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-bolt-elements-borderColorHover'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:browser text-2xl text-bolt-elements-textPrimary" />
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">WebContainer</h3>
            {currentMode === 'webcontainer' && (
              <div className="ml-auto">
                <div className="i-ph:check-circle text-green-500 text-xl" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 text-sm text-bolt-elements-textSecondary text-left">
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Runs in browser (free)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Instant startup</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Offline support</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="i-ph:x text-red-500" />
              <span>No databases</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
            <div className="text-lg font-bold text-green-600">
              {webContainerCost.estimatedCostPerHour === 0 ? 'FREE' : `$${webContainerCost.estimatedCostPerHour}/hr`}
            </div>
            <div className="text-xs text-bolt-elements-textTertiary">{webContainerCost.message}</div>
          </div>
        </button>

        {/* E2B Mode */}
        <button
          onClick={() => handleModeSelect('e2b')}
          disabled={disabled || !isE2BAvailable}
          className={`
            flex flex-col p-4 rounded-lg border-2 transition-all
            ${
              currentMode === 'e2b'
                ? 'border-bolt-elements-borderColorActive bg-bolt-elements-background-depth-3'
                : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:border-bolt-elements-borderColorHover'
            }
            ${disabled || !isE2BAvailable ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="i-ph:cloud text-2xl text-bolt-elements-textPrimary" />
            <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">E2B Cloud</h3>
            {currentMode === 'e2b' && (
              <div className="ml-auto">
                <div className="i-ph:check-circle text-green-500 text-xl" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 text-sm text-bolt-elements-textSecondary text-left">
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Full Linux environment</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Database support</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Python + pip packages</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="i-ph:check text-green-500" />
              <span>Native binaries</span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
            <div className="text-lg font-bold text-blue-600">${e2bCost.estimatedCostPerHour.toFixed(2)}/hr</div>
            <div className="text-xs text-bolt-elements-textTertiary">{e2bCost.message}</div>
          </div>

          {!isE2BAvailable && (
            <div className="mt-2 px-2 py-1 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-600">
              E2B SDK not installed. Run: npm install @e2b/code-interpreter
            </div>
          )}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-6 max-w-md">
            <h3 className="text-xl font-bold text-bolt-elements-textPrimary mb-4">Switch to E2B Cloud?</h3>

            <div className="flex flex-col gap-3 mb-6 text-bolt-elements-textSecondary">
              <div className="flex items-start gap-2">
                <div className="i-ph:warning text-yellow-500 text-xl mt-0.5" />
                <div>
                  <div className="font-semibold">Cloud-based execution</div>
                  <div className="text-sm">Your code will run on E2B's secure cloud infrastructure</div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="i-ph:currency-dollar text-blue-500 text-xl mt-0.5" />
                <div>
                  <div className="font-semibold">Usage costs apply</div>
                  <div className="text-sm">
                    ~${e2bCost.estimatedCostPerSession} for estimated session duration
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="i-ph:clock text-gray-500 text-xl mt-0.5" />
                <div>
                  <div className="font-semibold">Slightly higher latency</div>
                  <div className="text-sm">Network round-trips add 50-200ms vs instant WebContainer</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-bolt-elements-borderColor text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModeChange}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Switch to E2B
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
