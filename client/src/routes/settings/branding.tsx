import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useBrand } from "@/contexts/BrandContext";
import { Eye, Palette, Mail, Globe, Image } from "lucide-react";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/settings/branding")({
  component: BrandingPage,
});

function BrandingPage() {
  const t = useT();
  const { brand, isLoading, updateBrand, applyBrandStyles } = useBrand();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    brandName: "",
    brandLogoUrl: "",
    brandPrimaryColor: "#06b6d4",
    customDomain: "",
    fromEmail: "Skerry <onboarding@resend.dev>",
  });

  useEffect(() => {
    if (brand) {
      setFormData({
        brandName: brand.brandName,
        brandLogoUrl: brand.brandLogoUrl,
        brandPrimaryColor: brand.brandPrimaryColor,
        customDomain: brand.customDomain,
        fromEmail: brand.fromEmail,
      });
    }
  }, [brand]);

  const handleSave = async () => {
    if (!brand) return;

    setIsSaving(true);
    try {
      await updateBrand(formData);
      toast.success(t("branding.saved"));
    } catch (err) {
      toast.error(t("branding.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    if (!brand) return;

    const previewBrand = { ...brand, ...formData };
    applyBrandStylesToDOM(previewBrand);
  };

  const handleReset = () => {
    if (!brand) return;

    setFormData({
      brandName: brand.brandName,
      brandLogoUrl: brand.brandLogoUrl,
      brandPrimaryColor: brand.brandPrimaryColor,
      customDomain: brand.customDomain,
      fromEmail: brand.fromEmail,
    });
    applyBrandStyles();
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">{t("branding.loading")}</p>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center text-muted-foreground">
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>{t("branding.notAvailable")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("branding.title")}</h1>
        <p className="text-muted-foreground mt-2">{t("branding.subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Settings Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              {t("branding.settings")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="brand-name">{t("branding.brandName")}</Label>
              <Input
                id="brand-name"
                placeholder="Ihr Unternehmen"
                value={formData.brandName}
                onChange={e =>
                  setFormData(prev => ({ ...prev, brandName: e.target.value }))
                }
              />
            </div>

            <div>
              <Label htmlFor="brand-logo">{t("branding.logo")}</Label>
              <Input
                id="brand-logo"
                placeholder="https://example.com/logo.png"
                value={formData.brandLogoUrl}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    brandLogoUrl: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                PNG oder SVG, empfohlene Größe: 200x40px
              </p>
            </div>

            <div>
              <Label htmlFor="brand-color">{t("branding.primaryColor")}</Label>
              <div className="flex gap-2">
                <Input
                  id="brand-color"
                  type="color"
                  value={formData.brandPrimaryColor}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      brandPrimaryColor: e.target.value,
                    }))
                  }
                  className="w-16 h-10"
                />
                <Input
                  value={formData.brandPrimaryColor}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      brandPrimaryColor: e.target.value,
                    }))
                  }
                  placeholder="#06b6d4"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="custom-domain">
                {t("branding.customDomain")}
              </Label>
              <div className="flex gap-2">
                <Globe className="w-4 h-4 mt-2.5 text-muted-foreground" />
                <Input
                  id="custom-domain"
                  placeholder="app.ihrunternehmen.de"
                  value={formData.customDomain}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      customDomain: e.target.value,
                    }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Für Custom Domains kontaktieren Sie bitte unser Sales-Team
              </p>
            </div>

            <div>
              <Label htmlFor="from-email">{t("branding.fromEmail")}</Label>
              <div className="flex gap-2">
                <Mail className="w-4 h-4 mt-2.5 text-muted-foreground" />
                <Input
                  id="from-email"
                  placeholder="Ihr Unternehmen <team@ihrunternehmen.de>"
                  value={formData.fromEmail}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      fromEmail: e.target.value,
                    }))
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Muss in Resend verifiziert sein
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? t("branding.saving") : t("branding.save")}
              </Button>
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="w-4 h-4 mr-2" />
                {t("branding.preview")}
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                {t("branding.reset")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Live Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {t("branding.livePreview")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-4">
                {formData.brandLogoUrl ? (
                  <img
                    src={formData.brandLogoUrl}
                    alt={formData.brandName}
                    className="h-8 object-contain"
                    onError={e => {
                      e.currentTarget.src = "";
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div
                    className="h-8 w-8 rounded flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: formData.brandPrimaryColor }}
                  >
                    {formData.brandName.charAt(0)}
                  </div>
                )}
                <h3
                  className="font-bold text-lg"
                  style={{ color: formData.brandPrimaryColor }}
                >
                  {formData.brandName}
                </h3>
              </div>

              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  <strong>From:</strong> {formData.fromEmail}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Domain:</strong>{" "}
                  {formData.customDomain || "skerry.app"}
                </div>
                <div className="text-sm text-muted-foreground">
                  <strong>Primary Color:</strong> {formData.brandPrimaryColor}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    style={{ backgroundColor: formData.brandPrimaryColor }}
                  >
                    {t("branding.exampleButton")}
                  </Button>
                  <Button variant="outline" size="sm">
                    {t("branding.outlineButton")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>
                Die Vorschau zeigt wie Ihr Branding in der Anwendung aussehen
                wird. Änderungen werden sofort angewendet wenn Sie auf
                "Vorschau" klicken.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Notice */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="text-yellow-600">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-medium text-yellow-800">
                White-Label Funktion
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Diese Funktion ist Teil des Agency-Plans. Für vollständiges
                White-Label mit eigener Domain und erweiterten Branding-Optionen
                kontaktieren Sie bitte unser Sales-Team.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to apply brand styles (moved from context for preview)
function applyBrandStylesToDOM(brand: any) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", brand.brandPrimaryColor);
  root.style.setProperty("--brand-name", `"${brand.brandName}"`);

  if (brand.brandName !== "Skerry") {
    document.title = `${brand.brandName} — AI Lead Generation`;
  }
}
