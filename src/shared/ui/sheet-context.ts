'use client';

/**
 * Sheet context, split out of sheet.tsx to keep that file under the 200-line
 * cap. Both the root and the subcomponents read from here, so keeping it in a
 * leaf module also avoids a cycle between them.
 */

import * as React from 'react';

export interface SheetContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SheetContext = React.createContext<SheetContextValue | null>(null);

export function useSheet() {
  const ctx = React.useContext(SheetContext);
  if (!ctx) throw new Error('Sheet components must be used within Sheet');
  return ctx;
}

export const SheetTitleIdContext = React.createContext<string | undefined>(undefined);
