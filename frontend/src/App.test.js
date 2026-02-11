import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen when no token is present', () => {
  render(<App />);
  // When there is no JWT token in localStorage, App redirects to /login.
  expect(screen.getByText(/Вход в системата/i)).toBeInTheDocument();
});
