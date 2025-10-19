import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import App from './App';

describe('App', () => {
  it('renders OK message', () => {
    render(<App />);
    expect(screen.getByText(/OK/i)).toBeInTheDocument();
  });
});
