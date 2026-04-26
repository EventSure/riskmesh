import { renderHook, act } from '@testing-library/react';
import { useThemeMode } from '@/hooks/useThemeMode';

beforeEach(() => localStorage.clear());

test('기본값은 dark', () => {
  const { result } = renderHook(() => useThemeMode());
  expect(result.current.mode).toBe('dark');
});

test('toggle 시 light로 전환', () => {
  const { result } = renderHook(() => useThemeMode());
  act(() => result.current.toggle());
  expect(result.current.mode).toBe('light');
});

test('localStorage에 저장됨', () => {
  const { result } = renderHook(() => useThemeMode());
  act(() => result.current.toggle());
  expect(localStorage.getItem('theme-mode')).toBe('light');
});

test('localStorage에서 복원', () => {
  localStorage.setItem('theme-mode', 'light');
  const { result } = renderHook(() => useThemeMode());
  expect(result.current.mode).toBe('light');
});
