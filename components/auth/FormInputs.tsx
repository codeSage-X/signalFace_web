'use client';

import { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const inputClass =
  'w-full px-4 py-3 glass-input rounded-xl text-foreground placeholder-muted-foreground text-sm';

export const TextInput = ({
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
}) => (
  <div>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
    {error && <p className="text-destructive text-xs mt-1">{error}</p>}
  </div>
);

export const EmailInput = ({
  value,
  onChange,
  placeholder = 'Email address',
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) => (
  <TextInput
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    error={error}
    type="email"
  />
);

export const DateInput = ({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) => (
  <div>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      max={new Date().toISOString().split('T')[0]}
      className={`${inputClass} [color-scheme:dark]`}
    />
    {error && <p className="text-destructive text-xs mt-1">{error}</p>}
  </div>
);

export const SelectInput = ({
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  error?: string;
}) => (
  <div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} ${!value ? 'text-muted-foreground' : ''}`}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-card text-foreground">
          {o.label}
        </option>
      ))}
    </select>
    {error && <p className="text-destructive text-xs mt-1">{error}</p>}
  </div>
);

export const PasswordInput = ({
  value,
  onChange,
  placeholder = 'Password',
  error,
  showStrength = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  showStrength?: boolean;
}) => {
  const [show, setShow] = useState(false);

  const strength = (() => {
    if (!value) return 0;
    let s = 0;
    if (value.length >= 8) s++;
    if (/[A-Z]/.test(value)) s++;
    if (/[0-9]/.test(value)) s++;
    if (/[^a-zA-Z0-9]/.test(value)) s++;
    return s;
  })();

  const strengthColor = [
    '',
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-green-500',
  ][strength];

  return (
    <div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2 flex gap-1">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${i < strength ? strengthColor : 'bg-white/10'}`}
            />
          ))}
        </div>
      )}
      {error && <p className="text-destructive text-xs mt-1">{error}</p>}
    </div>
  );
};

export const OtpInput = ({
  value,
  onChange,
  error,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  length?: number;
}) => {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const setDigit = (index: number, digit: string) => {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(''));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    setDigit(index, digit);
    if (digit && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pasted) {
      e.preventDefault();
      onChange(pasted.padEnd(length, '').slice(0, length));
      inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
    }
  };

  return (
    <div>
      <div className="flex gap-2 justify-center">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className="w-11 h-12 text-center text-lg font-semibold glass-input rounded-xl text-foreground"
          />
        ))}
      </div>
      {error && <p className="text-destructive text-xs mt-2 text-center">{error}</p>}
    </div>
  );
};
