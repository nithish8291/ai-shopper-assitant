"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type ClientDetails = {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  corporateName: string | null;
  corporateDocument: string | null;
  isCorporate: boolean;
};

type ClientContextType = {
  client: ClientDetails | null;
  setClient: (c: ClientDetails) => void;
};

const defaultClient: ClientDetails = {
  email: null,
  firstName: null,
  lastName: null,
  phone: null,
  corporateName: null,
  corporateDocument: null,
  isCorporate: false,
};

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export const ClientProvider = ({ children }: { children: ReactNode }) => {
  const [client, setClient] = useState<ClientDetails | null>(defaultClient);
  return (
    <ClientContext.Provider value={{ client, setClient }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClient = () => {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error("useClient must be used within ClientProvider");
  return ctx;
};
