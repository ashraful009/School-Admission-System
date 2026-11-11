import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider, LANG_STORAGE_KEY, type Language } from '../shared/i18n';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  lang?: Language;
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {},
) {
  const {
    initialEntries = ['/'],
    lang = 'en',
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  localStorage.setItem(LANG_STORAGE_KEY, lang);

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <MemoryRouter initialEntries={initialEntries}>
            {children}
          </MemoryRouter>
        </I18nProvider>
      </QueryClientProvider>
    );
  };

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

