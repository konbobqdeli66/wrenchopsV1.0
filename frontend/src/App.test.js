// NOTE:
// The default CRA template test expected a "learn react" link.
// This app renders a login screen by default, so we assert that instead.
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen', () => {
  render(<App />);
  expect(screen.getByText(/Вход в системата/i)).toBeInTheDocument();
});
