# Bug Report for bolt.new

**Date**: 2025-11-06
**Analysis**: Comprehensive codebase bug analysis

## Summary
This report identifies 16 bugs found in the bolt.new codebase, ranging from critical issues (infinite loops, memory leaks) to medium priority bugs (missing dependencies, error handling) and low priority issues (inconsistent logging).

---

## 🔴 Critical Bugs

### 1. Infinite Loop in Preview Component
**File**: `app/components/workbench/Preview.tsx:31`
**Severity**: CRITICAL
**Type**: Infinite Re-render Loop

**Issue**:
```typescript
useEffect(() => {
  // ... code that sets iframeUrl
  setIframeUrl(baseUrl);
}, [activePreview, iframeUrl]); // Bug: iframeUrl is both read AND written in this effect
```

**Impact**: This creates an infinite loop where the effect triggers itself continuously, causing performance degradation and potential browser crash.

**Fix**: Remove `iframeUrl` from the dependency array since it's a derived value, not a dependency.

---

### 2. Memory Leak - Terminal Refs Growing Unbounded
**File**: `app/components/workbench/EditorPanel.tsx:241-243`
**Severity**: CRITICAL
**Type**: Memory Leak

**Issue**:
```typescript
<Terminal
  ref={(ref) => {
    terminalRefs.current.push(ref); // Bug: Array grows indefinitely on each render
  }}
  // ...
/>
```

**Impact**: The `terminalRefs.current` array grows with every render without ever being cleared, causing a memory leak that worsens over time.

**Fix**: Clear the array before populating it, or use indexed assignment instead of push.

---

### 3. Memory Leak - Abort Event Listener Never Removed
**File**: `app/lib/runtime/action-runner.ts:135-137`
**Severity**: CRITICAL
**Type**: Memory Leak

**Issue**:
```typescript
action.abortSignal.addEventListener('abort', () => {
  process.kill();
});
// No removeEventListener - listener persists after action completes
```

**Impact**: Event listeners accumulate with each action, never being cleaned up, leading to memory leaks in long-running sessions.

**Fix**: Store the listener function and remove it when the action completes or when the process exits.

---

### 4. Unhandled Stream Errors
**File**: `app/lib/runtime/action-runner.ts:139-145`
**Severity**: CRITICAL
**Type**: Missing Error Handling

**Issue**:
```typescript
process.output.pipeTo(
  new WritableStream({
    write(data) {
      console.log(data);
    },
  }),
); // No error handling for stream failures
```

**Impact**: If the stream fails, it will throw an unhandled promise rejection, potentially crashing the application or leaving actions in an inconsistent state.

**Fix**: Add error handling to the WritableStream or catch the pipeTo promise.

---

### 5. Incorrect Object Iteration
**File**: `app/lib/stores/files.ts:141`
**Severity**: CRITICAL
**Type**: Logic Error

**Issue**:
```typescript
for (const [direntPath] of Object.entries(this.files)) {
  // Bug: this.files is a MapStore, not a plain object
  // Should be: Object.entries(this.files.get())
```

**Impact**: This code attempts to iterate over a nanostores MapStore directly instead of its value, which won't work as intended. Files won't be properly cleaned up when directories are removed.

**Fix**: Change to `Object.entries(this.files.get())`.

---

## 🟡 Medium Priority Bugs

### 6. Missing Dependency in Terminal Effect
**File**: `app/components/workbench/terminal/Terminal.tsx:73`
**Severity**: MEDIUM
**Type**: React Hooks Violation

**Issue**:
```typescript
useEffect(() => {
  const terminal = terminalRef.current!;
  terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
  terminal.options.disableStdin = readonly;
}, [theme, readonly]); // Missing: onTerminalResize
```

**Impact**: If `onTerminalResize` changes between renders, the effect won't re-run with the updated callback, potentially causing stale closures.

**Fix**: Either add `onTerminalResize` to dependencies or use useCallback for the prop.

---

### 7. Missing Dependency in Terminal Imperative Handle
**File**: `app/components/workbench/terminal/Terminal.tsx:82`
**Severity**: MEDIUM
**Type**: React Hooks Violation

**Issue**:
```typescript
useImperativeHandle(ref, () => {
  return {
    reloadStyles: () => {
      const terminal = terminalRef.current!;
      terminal.options.theme = getTerminalTheme(readonly ? { cursor: '#00000000' } : {});
    },
  };
}, []); // Missing: readonly
```

**Impact**: The imperative handle captures the initial value of `readonly` and won't update if it changes.

**Fix**: Add `readonly` to the dependency array.

---

### 8. Silent File Operation Failures
**File**: `app/lib/runtime/action-runner.ts:165-178`
**Severity**: MEDIUM
**Type**: Improper Error Handling

**Issue**:
```typescript
try {
  await webcontainer.fs.mkdir(folder, { recursive: true });
  logger.debug('Created folder', folder);
} catch (error) {
  logger.error('Failed to create folder\n\n', error);
  // Bug: Error is caught but not re-thrown
}

try {
  await webcontainer.fs.writeFile(action.filePath, action.content);
  logger.debug(`File written ${action.filePath}`);
} catch (error) {
  logger.error('Failed to write file\n\n', error);
  // Bug: Error is caught but action marked as complete anyway
}
```

**Impact**: File operations can fail silently, with the action being marked as complete even when files weren't actually written. This leads to confusing behavior where the AI thinks files were created but they don't exist.

**Fix**: Re-throw errors or properly handle them by marking the action as failed.

---

### 9. No Error Handling for Fetch Request
**File**: `app/lib/hooks/usePromptEnhancer.ts:19-24`
**Severity**: MEDIUM
**Type**: Missing Error Handling

**Issue**:
```typescript
const response = await fetch('/api/enhancer', {
  method: 'POST',
  body: JSON.stringify({ message: input }),
}); // No try-catch or error checking
```

**Impact**: Network errors will cause unhandled promise rejections. Non-200 responses aren't checked.

**Fix**: Wrap in try-catch and check response.ok before proceeding.

---

### 10. setTimeout with No Delay
**File**: `app/lib/hooks/usePromptEnhancer.ts:63-65`
**Severity**: MEDIUM
**Type**: Logic Error

**Issue**:
```typescript
setTimeout(() => {
  setInput(_input);
}); // No delay specified - equivalent to setTimeout(..., 0)
```

**Impact**: While this works, it's likely unintentional. If a delay was intended (e.g., to debounce), it's missing. If no delay is needed, the setTimeout is unnecessary.

**Fix**: Either specify the intended delay or remove the setTimeout if immediate execution is desired.

---

### 11. Missing Dependency in Chat Effect (initialMessages length check)
**File**: `app/components/chat/Chat.client.tsx:95-97`
**Severity**: MEDIUM
**Type**: React Hooks Violation

**Issue**:
```typescript
useEffect(() => {
  chatStore.setKey('started', initialMessages.length > 0);
}, []); // Missing: initialMessages
```

**Impact**: This effect only runs once on mount, but uses `initialMessages.length`. If the component is reused with different initial messages, the chat started state won't update correctly.

**Fix**: Add `initialMessages` to the dependency array or `initialMessages.length`.

---

### 12. Missing Dependencies in Message Parsing Effect
**File**: `app/components/chat/Chat.client.tsx:99-105`
**Severity**: MEDIUM
**Type**: React Hooks Violation

**Issue**:
```typescript
useEffect(() => {
  parseMessages(messages, isLoading);

  if (messages.length > initialMessages.length) {
    storeMessageHistory(messages).catch((error) => toast.error(error.message));
  }
}, [messages, isLoading, parseMessages]); // Missing: initialMessages, storeMessageHistory
```

**Impact**: `initialMessages` is used in the comparison but not in dependencies. `storeMessageHistory` should also be included to follow React's exhaustive-deps rule. This could cause stale closures.

**Fix**: Add `initialMessages` and `storeMessageHistory` to the dependency array.

---

### 13. Missing Dependency in Preview Effect
**File**: `app/components/workbench/Preview.tsx:66`
**Severity**: MEDIUM
**Type**: React Hooks Violation

**Issue**:
```typescript
useEffect(() => {
  if (previews.length > 1 && !hasSelectedPreview.current) {
    const minPortIndex = previews.reduce(findMinPortIndex, 0);
    setActivePreviewIndex(minPortIndex);
  }
}, [previews]); // Missing: findMinPortIndex
```

**Impact**: `findMinPortIndex` is a memoized function that should be in the dependencies, though since it's memoized with empty deps, this is less critical.

**Fix**: Add `findMinPortIndex` to the dependency array for correctness.

---

### 14. Potential Stale Closure in Workbench Effect
**File**: `app/components/workbench/Workbench.client.tsx:70-74`
**Severity**: MEDIUM
**Type**: React Hooks Violation

**Issue**:
```typescript
useEffect(() => {
  if (hasPreview) {
    setSelectedView('preview'); // Uses local function
  }
}, [hasPreview]); // Missing: setSelectedView (though it's a local function)
```

**Impact**: `setSelectedView` is a local function that's not in the dependency array. While this works because it's defined in the same component, it's better to either include it or use `workbenchStore.currentView.set` directly.

**Fix**: Either add `setSelectedView` to deps or call `workbenchStore.currentView.set('preview')` directly.

---

## 🟢 Low Priority Issues

### 15. Inconsistent Error Logging (console.log instead of logger)
**File**: `app/lib/stores/files.ts:194`
**Severity**: LOW
**Type**: Inconsistent Logging

**Issue**:
```typescript
try {
  return utf8TextDecoder.decode(buffer);
} catch (error) {
  console.log(error); // Should use logger.error
  return '';
}
```

**Impact**: Inconsistent logging makes debugging harder and breaks the scoped logger pattern used throughout the codebase.

**Fix**: Change to `logger.error('Failed to decode file content', error)`.

---

### 16. Inconsistent Error Logging in API Route
**File**: `app/routes/api.chat.ts:52`
**Severity**: LOW
**Type**: Inconsistent Logging

**Issue**:
```typescript
} catch (error) {
  console.log(error); // Should use proper logging
  throw new Response(null, {
    status: 500,
    statusText: 'Internal Server Error',
  });
}
```

**Impact**: Console.log in production server code makes debugging difficult and doesn't integrate with proper logging infrastructure.

**Fix**: Use proper server-side logging (e.g., `console.error` at minimum, or integrate with logging service).

---

## Summary Statistics

- **Total Bugs Found**: 16
- **Critical**: 5
- **Medium**: 9
- **Low**: 2

### Breakdown by Category:
- Memory Leaks: 2
- React Hooks Violations: 6
- Error Handling Issues: 5
- Logic Errors: 2
- Code Quality: 2

---

## Recommendations

1. **Immediate Action Required**: Fix critical bugs #1-5, especially the infinite loop and memory leaks
2. **High Priority**: Address React hooks violations to prevent unexpected behavior
3. **Code Review**: Implement stricter ESLint rules for React hooks and error handling
4. **Testing**: Add integration tests to catch these types of issues earlier
5. **Monitoring**: Implement memory leak detection in development environment

---

## Additional Notes

The codebase is generally well-structured and uses modern patterns. However, there are several recurring patterns:

1. Missing cleanup in React hooks (useEffect)
2. Inconsistent error handling (some errors caught but not propagated)
3. React exhaustive-deps warnings not being addressed
4. Mixing console.log/console.error with proper logging utilities

These issues can be mitigated with:
- Stricter ESLint configuration with `react-hooks/exhaustive-deps` set to error
- Consistent error handling patterns
- Code review checklist including memory leak checks
- Automated testing for memory leaks and re-render loops
