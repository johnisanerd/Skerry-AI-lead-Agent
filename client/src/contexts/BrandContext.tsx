/**
 * Brand Context - manages white-label branding settings.
 * Dependencies: React, Zustand
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";

interface BrandSettings {
  workspaceId: string;
  brandName: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  customDomain: string;
  fromEmail: string;
}

interface BrandContextValue {
  brand: BrandSettings | null;
  isLoading: boolean;
  updateBrand: (updates: Partial<BrandSettings>) => Promise<void>;
  applyBrandStyles: () => void;
}

const defaultBrand: BrandSettings = {
  workspaceId: "",
  brandName: "Skerry",
  brandLogoUrl: "",
  brandPrimaryColor: "#06b6d4",
  customDomain: "",
  fromEmail: "Skerry <onboarding@resend.dev>"
};

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load brand settings on mount
  useEffect(() => {
    loadBrandSettings();
  }, []);

  const loadBrandSettings = async () => {
    try {
      if (!supabase) {
        // Fallback to default
        setBrand(defaultBrand);
        setIsLoading(false);
        return;
      }

      // Try to get brand settings from current workspace
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBrand(defaultBrand);
        setIsLoading(false);
        return;
      }

      // Get current workspace from URL or localStorage
      const currentWorkspaceId = localStorage.getItem('skerry-workspace-current');
      if (!currentWorkspaceId) {
        setBrand(defaultBrand);
        setIsLoading(false);
        return;
      }

      // Load brand settings from workspace
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('brand_name, brand_logo_url, brand_primary_color, custom_domain, from_email')
        .eq('id', currentWorkspaceId)
        .single();

      if (workspace) {
        const brandSettings: BrandSettings = {
          workspaceId: currentWorkspaceId,
          brandName: workspace.brand_name || "Skerry",
          brandLogoUrl: workspace.brand_logo_url || "",
          brandPrimaryColor: workspace.brand_primary_color || "#06b6d4",
          customDomain: workspace.custom_domain || "",
          fromEmail: workspace.from_email || "Skerry <onboarding@resend.dev>"
        };
        setBrand(brandSettings);
        applyBrandStylesToDOM(brandSettings);
      } else {
        setBrand(defaultBrand);
        applyBrandStylesToDOM(defaultBrand);
      }
    } catch (err) {
      console.error('Failed to load brand settings:', err);
      setBrand(defaultBrand);
      applyBrandStylesToDOM(defaultBrand);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBrand = async (updates: Partial<BrandSettings>) => {
    if (!brand || !supabase) return;

    try {
      const { error } = await supabase
        .from('workspaces')
        .update({
          brand_name: updates.brandName,
          brand_logo_url: updates.brandLogoUrl,
          brand_primary_color: updates.brandPrimaryColor,
          custom_domain: updates.customDomain,
          from_email: updates.fromEmail
        })
        .eq('id', brand.workspaceId);

      if (error) throw error;

      const updatedBrand = { ...brand, ...updates };
      setBrand(updatedBrand);
      applyBrandStylesToDOM(updatedBrand);
    } catch (err) {
      console.error('Failed to update brand settings:', err);
      throw err;
    }
  };

  const applyBrandStyles = () => {
    if (brand) {
      applyBrandStylesToDOM(brand);
    }
  };

  return (
    <BrandContext.Provider value={{ brand, isLoading, updateBrand, applyBrandStyles }}>
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand(): BrandContextValue {
  const context = useContext(BrandContext);
  if (context === undefined) {
    throw new Error("useBrand must be used within a BrandProvider");
  }
  return context;
}

/**
 * Applies brand settings to CSS variables
 */
function applyBrandStylesToDOM(brand: BrandSettings) {
  const root = document.documentElement;
  
  // Set CSS variables
  root.style.setProperty('--brand-primary', brand.brandPrimaryColor);
  root.style.setProperty('--brand-name', `"${brand.brandName}"`);
  
  // Update page title
  if (brand.brandName !== "Skerry") {
    document.title = `${brand.brandName} — AI Lead Generation`;
  }
  
  // Update favicon if custom logo is set
  if (brand.brandLogoUrl) {
    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (favicon) {
      favicon.href = brand.brandLogoUrl;
    }
  }
}

/**
 * Public function to get brand settings for a workspace (no auth required)
 */
export async function getPublicBrandSettings(workspaceId: string): Promise<BrandSettings | null> {
  try {
    if (!supabase) return null;

    const { data } = await supabase
      .from('workspace_brand_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (data) {
      return {
        workspaceId: data.workspace_id,
        brandName: data.brand_name || "Skerry",
        brandLogoUrl: data.brand_logo_url || "",
        brandPrimaryColor: data.brand_primary_color || "#06b6d4",
        customDomain: data.custom_domain || "",
        fromEmail: data.from_email || "Skerry <onboarding@resend.dev>"
      };
    }

    return null;
  } catch (err) {
    console.error('Failed to get public brand settings:', err);
    return null;
  }
}
