# Bugs Organized by File

Quick reference guide for fixing bugs in each file.

---

## `app/components/workbench/Preview.tsx`

### Bug #1: Infinite Loop (CRITICAL)
**Line**: 31
```typescript
useEffect(() => {
  // ...
  setIframeUrl(baseUrl);
}, [activePreview, iframeUrl]); // ❌ Remove iframeUrl from deps
```
**Fix**: Remove `iframeUrl` from dependency array

### Bug #13: Missing Dependency
**Line**: 66
```typescript
}, [previews]); // ❌ Add findMinPortIndex
```
**Fix**: Add `findMinPortIndex` to dependency array

---

## `app/components/workbench/EditorPanel.tsx`

### Bug #2: Memory Leak - Terminal Refs (CRITICAL)
**Line**: 241-243
```typescript
ref={(ref) => {
  terminalRefs.current.push(ref); // ❌ Array grows unbounded
}}
```
**Fix**: Use indexed assignment or clear array before mapping:
```typescript
// Option 1: Clear before rendering
useEffect(() => {
  terminalRefs.current = [];
}, [terminalCount]);

// Option 2: Use indexed assignment
ref={(ref) => {
  terminalRefs.current[index] = ref;
}}
```

---

## `app/components/workbench/terminal/Terminal.tsx`

### Bug #6: Missing Dependency
**Line**: 73
```typescript
}, [theme, readonly]); // ❌ Add onTerminalResize
```
**Fix**: Add `onTerminalResize` to deps OR wrap it in useCallback at call site

### Bug #7: Missing Dependency in useImperativeHandle
**Line**: 82
```typescript
}, []); // ❌ Add readonly
```
**Fix**: Add `readonly` to dependency array

---

## `app/components/workbench/Workbench.client.tsx`

### Bug #14: Potential Stale Closure
**Line**: 70-74
```typescript
useEffect(() => {
  if (hasPreview) {
    setSelectedView('preview'); // Could be stale
  }
}, [hasPreview]); // ❌ Add setSelectedView to deps
```
**Fix**: Either add `setSelectedView` to deps OR call workbenchStore directly:
```typescript
useEffect(() => {
  if (hasPreview) {
    workbenchStore.currentView.set('preview');
  }
}, [hasPreview]);
```

---

## `app/components/chat/Chat.client.tsx`

### Bug #11: Missing Dependency
**Line**: 95-97
```typescript
useEffect(() => {
  chatStore.setKey('started', initialMessages.length > 0);
}, []); // ❌ Add initialMessages
```
**Fix**: Add `initialMessages` or `initialMessages.length` to deps

### Bug #12: Missing Dependencies
**Line**: 99-105
```typescript
}, [messages, isLoading, parseMessages]); // ❌ Add initialMessages, storeMessageHistory
```
**Fix**: Add missing dependencies:
```typescript
}, [messages, isLoading, parseMessages, initialMessages, storeMessageHistory]);
```

---

## `app/lib/runtime/action-runner.ts`

### Bug #3: Memory Leak - Event Listener (CRITICAL)
**Line**: 135-137
```typescript
action.abortSignal.addEventListener('abort', () => {
  process.kill();
}); // ❌ Never removed
```
**Fix**: Store handler and remove it:
```typescript
const abortHandler = () => process.kill();
action.abortSignal.addEventListener('abort', abortHandler);

// After process completes:
action.abortSignal.removeEventListener('abort', abortHandler);
```

### Bug #4: Unhandled Stream Errors (CRITICAL)
**Line**: 139-145
```typescript
process.output.pipeTo(
  new WritableStream({
    write(data) {
      console.log(data);
    },
  }),
); // ❌ No error handling
```
**Fix**: Add error handling:
```typescript
process.output.pipeTo(
  new WritableStream({
    write(data) {
      console.log(data);
    },
    abort(err) {
      logger.error('Stream aborted:', err);
    },
  }),
).catch((error) => {
  logger.error('Failed to pipe output:', error);
});
```

### Bug #8: Silent File Operation Failures
**Line**: 165-178
```typescript
try {
  await webcontainer.fs.mkdir(folder, { recursive: true });
} catch (error) {
  logger.error('Failed to create folder\n\n', error);
  // ❌ Error swallowed
}

try {
  await webcontainer.fs.writeFile(action.filePath, action.content);
} catch (error) {
  logger.error('Failed to write file\n\n', error);
  // ❌ Error swallowed
}
```
**Fix**: Re-throw errors so action is marked as failed:
```typescript
try {
  await webcontainer.fs.mkdir(folder, { recursive: true });
  logger.debug('Created folder', folder);
} catch (error) {
  logger.error('Failed to create folder\n\n', error);
  throw error; // ✅ Re-throw
}

try {
  await webcontainer.fs.writeFile(action.filePath, action.content);
  logger.debug(`File written ${action.filePath}`);
} catch (error) {
  logger.error('Failed to write file\n\n', error);
  throw error; // ✅ Re-throw
}
```

---

## `app/lib/stores/files.ts`

### Bug #5: Incorrect Object Iteration (CRITICAL)
**Line**: 141
```typescript
for (const [direntPath] of Object.entries(this.files)) {
  // ❌ this.files is a MapStore, not a plain object
```
**Fix**: Get the value from the MapStore:
```typescript
for (const [direntPath] of Object.entries(this.files.get())) {
```

### Bug #15: Inconsistent Error Logging
**Line**: 194
```typescript
} catch (error) {
  console.log(error); // ❌ Use logger
  return '';
}
```
**Fix**: Use consistent logging:
```typescript
} catch (error) {
  logger.error('Failed to decode file content', error);
  return '';
}
```

---

## `app/lib/hooks/usePromptEnhancer.ts`

### Bug #9: No Error Handling for Fetch
**Line**: 19-24
```typescript
const response = await fetch('/api/enhancer', {
  method: 'POST',
  body: JSON.stringify({ message: input }),
}); // ❌ No error handling
```
**Fix**: Add try-catch and response validation:
```typescript
try {
  const response = await fetch('/api/enhancer', {
    method: 'POST',
    body: JSON.stringify({ message: input }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  // ... rest of code
} catch (error) {
  logger.error('Failed to enhance prompt', error);
  setInput(originalInput);
  setEnhancingPrompt(false);
  setPromptEnhanced(false);
  return;
}
```

### Bug #10: setTimeout with No Delay
**Line**: 63-65
```typescript
setTimeout(() => {
  setInput(_input);
}); // ❌ No delay specified
```
**Fix**: Either add intended delay or remove setTimeout:
```typescript
// If immediate execution is fine:
setInput(_input);

// If delay is intended:
setTimeout(() => {
  setInput(_input);
}, 100); // Specify delay in ms
```

---

## `app/routes/api.chat.ts`

### Bug #16: Inconsistent Error Logging
**Line**: 52
```typescript
} catch (error) {
  console.log(error); // ❌ Use proper logging
```
**Fix**: Use console.error at minimum:
```typescript
} catch (error) {
  console.error('Chat API error:', error);
```

---

## Priority Order for Fixes

### Immediate (Critical - Fix Today):
1. Bug #5 - `files.ts:141` - Wrong object iteration
2. Bug #1 - `Preview.tsx:31` - Infinite loop
3. Bug #2 - `EditorPanel.tsx:241-243` - Terminal refs memory leak
4. Bug #3 - `action-runner.ts:135-137` - Event listener memory leak
5. Bug #4 - `action-runner.ts:139-145` - Unhandled stream errors

### High Priority (Fix This Week):
6. Bug #8 - `action-runner.ts:165-178` - Silent file failures
7. Bug #9 - `usePromptEnhancer.ts:19-24` - No fetch error handling
8. Bug #11 - `Chat.client.tsx:95-97` - Missing dependency
9. Bug #12 - `Chat.client.tsx:99-105` - Missing dependencies

### Medium Priority (Fix This Sprint):
10. Bug #6 - `Terminal.tsx:73` - Missing dependency
11. Bug #7 - `Terminal.tsx:82` - Missing dependency
12. Bug #10 - `usePromptEnhancer.ts:63-65` - setTimeout issue
13. Bug #13 - `Preview.tsx:66` - Missing dependency
14. Bug #14 - `Workbench.client.tsx:70-74` - Stale closure

### Low Priority (Technical Debt):
15. Bug #15 - `files.ts:194` - Inconsistent logging
16. Bug #16 - `api.chat.ts:52` - Inconsistent logging

---

## Testing Checklist

After fixing bugs, verify:

- [ ] Memory doesn't grow unbounded when opening/closing terminals
- [ ] Preview URLs update correctly without infinite loops
- [ ] Actions fail properly when file operations fail
- [ ] No console errors about missing dependencies
- [ ] Network errors in prompt enhancement are handled gracefully
- [ ] Directory deletion properly removes all child files
- [ ] Event listeners are cleaned up properly
