import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PrivacyPolicy from './PrivacyPolicy';

jest.mock('../components/layout/Footer', () => () => null);

test('privacy policy gives guests the deletion request path and current collection disclosures', () => {
  render(<MemoryRouter><PrivacyPolicy /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Request account deletion' }).getAttribute('href')).toBe('/delete-account.html');
  expect(screen.getByText(/UPI IDs are payment/)).toBeTruthy();
  expect(screen.getByText(/Firebase Analytics, Crashlytics/)).toBeTruthy();
  expect(screen.getByText(/safety reports and blocks/)).toBeTruthy();
  expect(screen.queryByText(/delete your Chess99 account from your profile settings/)).toBeNull();
});
