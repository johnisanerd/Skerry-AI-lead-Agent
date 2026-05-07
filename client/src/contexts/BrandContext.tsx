/**
 * Brand Context - manages white-label branding settings.
 * Dependencies: React, Zustand
 * Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 */

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseBrowser";
import { getBrandSettings, updateBrandSettings } from "@/lib/skerryApi";

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
  fromEmail: "Skerry <onboarding@resend.dev>",
};

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load brand settings on mount
  useEffect(() => {
    loadBrandSettings();
  }, []);

  const getCurrentWorkspaceId = (): string | null => {
    try {
      const raw = localStorage.getItem("skerry-workspace");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { currentId?: unknown };
      if (typeof parsed.currentId === "string" && parsed.currentId.trim()) {
        return parsed.currentId.trim();
      }
    } catch {
      // ignore malformed localStorage
    }
    return null;
  };

  const loadBrandSettings = async () => {
    try {
      const currentWorkspaceId = getCurrentWorkspaceId();
      if (!currentWorkspaceId) {
        setBrand(defaultBrand);
        setIsLoading(false);
        applyBrandStylesToDOM(defaultBrand);
        return;
      }

      const response = await getBrandSettings(currentWorkspaceId);
      if (!response.ok || !response.brand) {
        setBrand(defaultBrand);
        applyBrandStylesToDOM(defaultBrand);
        return;
      }

      const brandSettings: BrandSettings = {
        workspaceId: currentWorkspaceId,
        brandName: response.brand.brand_name || "Skerry",
        brandLogoUrl: response.brand.brand_logo_url || "",
        brandPrimaryColor: response.brand.brand_primary_color || "#06b6d4",
        customDomain: response.brand.custom_domain || "",
        fromEmail: response.brand.from_email || "Skerry <onboarding@resend.dev>",
      };
      setBrand(brandSettings);
      applyBrandStylesToDOM(brandSettings);
    } catch (err) {
      console.error("Failed to load brand settings:", err);
      setBrand(defaultBrand);
      applyBrandStylesToDOM(defaultBrand);
    } finally {
      setIsLoading(false);
    }
  };

  const updateBrand = async (updates: Partial<BrandSettings>) => {
    if (!brand) return;

    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      throw new Error("Workspace ID missing");
    }

    const response = await updateBrandSettings(workspaceId, {
      brand_name: updates.brandName,
      brand_logo_url: updates.brandLogoUrl,
      brand_primary_color: updates.brandPrimaryColor,
      custom_domain: updates.customDomain,
      from_email: updates.fromEmail,
    });

    if (!response.ok || !response.brand) {
      throw new Error(response.message || "Failed to update brand settings");
    }

    const updatedBrand: BrandSettings = {
      workspaceId,
      brandName: response.brand.brand_name || brand.brandName,
      brandLogoUrl: response.brand.brand_logo_url || brand.brandLogoUrl,
      brandPrimaryColor:
        response.brand.brand_primary_color || brand.brandPrimaryColor,
      customDomain: response.brand.custom_domain || brand.customDomain,
      fromEmail: response.brand.from_email || brand.fromEmail,
    };

    setBrand(updatedBrand);
    applyBrandStylesToDOM(updatedBrand);
  };

  const applyBrandStyles = () => {
    if (brand) {
      applyBrandStylesToDOM(brand);
    }
  };

  return (
    <BrandContext.Provider
      value={{ brand, isLoading, updateBrand, applyBrandStyles }}
    >
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
  root.style.setProperty("--brand-primary", brand.brandPrimaryColor);
  root.style.setProperty("--brand-name", `"${brand.brandName}"`);

  // Update page title
  if (brand.brandName !== "Skerry") {
    document.title = `${brand.brandName} — AI Lead Generation`;
  }

  // Update favicon if custom logo is set
  if (brand.brandLogoUrl) {
    const favicon = document.querySelector(
      'link[rel="icon"]'
    ) as HTMLLinkElement;
    if (favicon) {
      favicon.href = brand.brandLogoUrl;
    }
  }
}

/**
 * Public function to get brand settings for a workspace (no auth required)
 */
export async function getPublicBrandSettings(
  workspaceId: string
): Promise<BrandSettings | null> {
  try {
    if (!supabase) return null;

    const { data } = await supabase
      .from("workspace_brand_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .single();

    if (data) {
      return {
        workspaceId: data.workspace_id,
        brandName: data.brand_name || "Skerry",
        brandLogoUrl: data.brand_logo_url || "",
        brandPrimaryColor: data.brand_primary_color || "#06b6d4",
        customDomain: data.custom_domain || "",
        fromEmail: data.from_email || "Skerry <onboarding@resend.dev>",
      };
    }

    return null;
  } catch (err) {
    console.error("Failed to get public brand settings:", err);
    return null;
  }
}
