import React, { useState, useEffect, useRef } from 'react';

interface DebouncedPromptTextareaProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  debounceMs?: number;
  id?: string;
}

export const DebouncedPromptTextarea: React.FC<DebouncedPromptTextareaProps> = React.memo(({
  value,
  onChange,
  rows = 4,
  placeholder,
  className,
  onBlur,
  debounceMs = 150,
  id,
}) => {
  const [localVal, setLocalVal] = useState(value || '');
  const isTypingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only synchronize from upstream prop if the user is not actively typing
    if (!isTypingRef.current) {
      setLocalVal(value || '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    isTypingRef.current = true;
    setLocalVal(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onChange(nextVal);
    }, debounceMs);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isTypingRef.current = false;
    onChange(localVal);
    onBlur?.();
  };

  return (
    <textarea
      id={id}
      rows={rows}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
});

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  debounceMs?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  id?: string;
}

export const DebouncedInput: React.FC<DebouncedInputProps> = React.memo(({
  value,
  onChange,
  type = 'text',
  placeholder,
  className,
  onBlur,
  debounceMs = 150,
  onKeyDown,
  id,
}) => {
  const [localVal, setLocalVal] = useState(value || '');
  const isTypingRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalVal(value || '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    isTypingRef.current = true;
    setLocalVal(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      onChange(nextVal);
    }, debounceMs);
  };

  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isTypingRef.current = false;
    onChange(localVal);
    onBlur?.();
  };

  return (
    <input
      id={id}
      type={type}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      className={className}
    />
  );
});
