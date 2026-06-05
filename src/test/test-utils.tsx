import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { DbContext } from '../db/DbProvider';
import { IRepository } from '../db/repository';

export function renderWithDb(
  ui: React.ReactElement,
  {
    repository = {} as IRepository,
    dbReady = true,
    error = null as string | null,
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <DbContext.Provider value={{ dbReady, error, repository }}>
        {children}
      </DbContext.Provider>
    );
  }
  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions });
}

export { render, screen, fireEvent, waitFor, act, within, cleanup } from '@testing-library/react';
