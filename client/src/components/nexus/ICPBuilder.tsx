import { useState, useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Search, Building2, Users, Globe } from "lucide-react";
import { toast } from "sonner";
import { useT, useLanguageStore } from "@/lib/i18n";

interface ICPProfile {
  roles: string[];
  industries: string[];
  companySizeRange: string;
  locations: string[];
  businessDescription: string;
  idealCustomer: string;
}

const ROLE_SUGGESTIONS_EN = [
  "VP of Growth",
  "Head of Marketing",
  "CMO",
  "CRO",
  "Founder",
  "Director of Demand Gen",
  "VP of Sales",
  "Head of Business Development",
  "Chief Revenue Officer",
  "Marketing Director",
];

const ROLE_SUGGESTIONS_DE = [
  "VP Growth",
  "Leitung Marketing",
  "CMO",
  "CRO",
  "Founder",
  "Leitung Demand Gen",
  "VP Sales",
  "Leitung Business Development",
  "Chief Revenue Officer",
  "Marketing Director",
];

const INDUSTRY_OPTIONS_EN = [
  "SaaS",
  "FinTech",
  "HealthTech",
  "E-Commerce",
  "Agency",
  "Consulting",
  "Manufacturing",
  "Retail",
  "Education",
  "Real Estate",
];

const INDUSTRY_OPTIONS_DE = [
  "SaaS",
  "FinTech",
  "HealthTech",
  "E-Commerce",
  "Agentur",
  "Beratung",
  "Produktion",
  "Einzelhandel",
  "Bildung",
  "Immobilien",
];

const LOCATION_OPTIONS_EN = [
  "Germany",
  "Austria",
  "Switzerland",
  "UK",
  "USA",
  "Canada",
  "Australia",
  "Netherlands",
  "France",
  "Spain",
];

const LOCATION_OPTIONS_DE = [
  "Deutschland",
  "Österreich",
  "Schweiz",
  "UK",
  "USA",
  "Kanada",
  "Australien",
  "Niederlande",
  "Frankreich",
  "Spanien",
];

const COMPANY_SIZE_RANGES = [
  { label: "1-50", value: "1,50" },
  { label: "51-200", value: "51,200" },
  { label: "201-500", value: "201,500" },
  { label: "501-2000", value: "501,2000" },
  { label: "2000+", value: "2001,10000" },
];

export function ICPBuilder() {
  const { currentId } = useWorkspaceStore();
  const t = useT();
  const language = useLanguageStore(s => s.language);
  const roleSuggestions =
    language === "de" ? ROLE_SUGGESTIONS_DE : ROLE_SUGGESTIONS_EN;
  const industryOptions =
    language === "de" ? INDUSTRY_OPTIONS_DE : INDUSTRY_OPTIONS_EN;
  const locationOptions =
    language === "de" ? LOCATION_OPTIONS_DE : LOCATION_OPTIONS_EN;
  const [profile, setProfile] = useState<ICPProfile>({
    roles: [],
    industries: [],
    companySizeRange: "51,200",
    locations: [language === "de" ? "Deutschland" : "Germany"],
    businessDescription: "",
    idealCustomer: "",
  });
  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const pairs: Array<[string, string]> = [
      ["Deutschland", "Germany"],
      ["Österreich", "Austria"],
      ["Schweiz", "Switzerland"],
      ["Kanada", "Canada"],
      ["Australien", "Australia"],
      ["Niederlande", "Netherlands"],
      ["Frankreich", "France"],
      ["Spanien", "Spain"],
      ["Agentur", "Agency"],
      ["Beratung", "Consulting"],
      ["Produktion", "Manufacturing"],
      ["Einzelhandel", "Retail"],
      ["Bildung", "Education"],
      ["Immobilien", "Real Estate"],
      ["VP Growth", "VP of Growth"],
      ["Leitung Marketing", "Head of Marketing"],
      ["Leitung Demand Gen", "Director of Demand Gen"],
      ["VP Sales", "VP of Sales"],
      ["Leitung Business Development", "Head of Business Development"],
    ];
    const toEn = new Map(pairs);
    const toDe = new Map(pairs.map(([de, en]) => [en, de]));
    const map = language === "de" ? toDe : toEn;

    setProfile(prev => ({
      ...prev,
      locations: prev.locations.map(value => map.get(value) ?? value),
      industries: prev.industries.map(value => map.get(value) ?? value),
      roles: prev.roles.map(value => map.get(value) ?? value),
    }));
  }, [language]);

  // Load existing profile
  useEffect(() => {
    if (!currentId) return;

    fetch(`/api/workspaces/${currentId}/icp`, { credentials: "include" })
      .then(r => r.json())
      .then((data: { ok: boolean; icp?: any }) => {
        if (data.ok && data.icp) {
          setProfile({
            roles: data.icp.roles || [],
            industries: data.icp.industries || [],
            companySizeRange: data.icp.companySizeRange || "51,200",
            locations: data.icp.locations || ["Deutschland"],
            businessDescription: data.icp.business_description || "",
            idealCustomer: data.icp.ideal_customer || "",
          });
        }
      })
      .catch(() => {
        // Try localStorage fallback
        try {
          const raw = localStorage.getItem("skerry-onboarding-profile");
          if (raw) {
            const saved = JSON.parse(raw);
            setProfile(prev => ({ ...prev, ...saved }));
          }
        } catch {
          // Ignore
        }
      });
  }, [currentId]);

  // Auto-save with debounce
  useEffect(() => {
    if (!currentId) return;

    const timeoutId = setTimeout(() => {
      setIsSaving(true);

      // Save to server
      fetch(`/api/workspaces/${currentId}/icp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          business_description: profile.businessDescription,
          ideal_customer: profile.idealCustomer,
          roles: profile.roles,
          industries: profile.industries,
          locations: profile.locations,
          companySizeRange: profile.companySizeRange,
        }),
      })
        .then(r => r.json())
        .then((data: { ok: boolean; fallback?: string }) => {
          if (data.ok) {
            toast.success(t("icp.toast.saved"));
          } else if (data.fallback === "localStorage") {
            // Fallback to localStorage
            localStorage.setItem(
              "skerry-onboarding-profile",
              JSON.stringify(profile)
            );
            toast.info(t("icp.toast.savedLocal"));
          }
        })
        .catch(() => {
          // Final fallback to localStorage
          localStorage.setItem(
            "skerry-onboarding-profile",
            JSON.stringify(profile)
          );
          toast.info(t("icp.toast.savedLocal"));
        })
        .finally(() => setIsSaving(false));
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [profile, currentId]);

  const addRole = (role: string) => {
    if (role && !profile.roles.includes(role)) {
      setProfile(prev => ({ ...prev, roles: [...prev.roles, role] }));
      setNewRole("");
    }
  };

  const removeRole = (role: string) => {
    setProfile(prev => ({
      ...prev,
      roles: prev.roles.filter(r => r !== role),
    }));
  };

  const addLocation = (location: string) => {
    if (location && !profile.locations.includes(location)) {
      setProfile(prev => ({
        ...prev,
        locations: [...prev.locations, location],
      }));
      setNewLocation("");
    }
  };

  const removeLocation = (location: string) => {
    setProfile(prev => ({
      ...prev,
      locations: prev.locations.filter(l => l !== location),
    }));
  };

  const toggleIndustry = (industry: string) => {
    setProfile(prev => ({
      ...prev,
      industries: prev.industries.includes(industry)
        ? prev.industries.filter(i => i !== industry)
        : [...prev.industries, industry],
    }));
  };

  const getPreviewText = () => {
    const isDe = language === "de";
    const roles =
      profile.roles.length > 0
        ? profile.roles.slice(0, 2).join(isDe ? " oder " : " or ")
        : isDe
          ? t("icp.preview.rolesFallback")
          : t("icp.preview.rolesFallback");
    const industries =
      profile.industries.length > 0
        ? profile.industries.slice(0, 2).join(isDe ? " und " : " and ")
        : isDe
          ? t("icp.preview.industriesFallback")
          : t("icp.preview.industriesFallback");
    const sizeRange =
      COMPANY_SIZE_RANGES.find(r => r.value === profile.companySizeRange)
        ?.label || "51-200";
    const locations = profile.locations
      .slice(0, 2)
      .join(isDe ? " und " : " and ");

    if (isDe) {
      return `${t("icp.preview.prefixDe")} ${roles} ${t("icp.preview.atDe")} ${industries} ${t("icp.preview.sizeDe")} ${sizeRange} ${t("icp.preview.employeesDe")} ${t("icp.preview.inDe")} ${locations}.`;
    }
    return `${t("icp.preview.prefixEn")} ${roles} ${t("icp.preview.atEn")} ${industries} ${t("icp.preview.sizeEn")} ${sizeRange} ${t("icp.preview.employeesEn")} ${t("icp.preview.inEn")} ${locations}.`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            {t("icp.builder.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rollen */}
          <div>
            <Label className="text-sm font-medium">
              {t("icp.roles.label")}
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.roles.map(role => (
                <Badge key={role} variant="secondary" className="gap-1">
                  {role}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeRole(role)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder={t("icp.roles.placeholder")}
                value={newRole}
                onChange={e => setNewRole(e.target.value)}
                onKeyPress={e => e.key === "Enter" && addRole(newRole)}
              />
              <Button onClick={() => addRole(newRole)} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {roleSuggestions
                .filter(role => !profile.roles.includes(role))
                .slice(0, 5)
                .map(role => (
                  <Badge
                    key={role}
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => addRole(role)}
                  >
                    {role}
                  </Badge>
                ))}
            </div>
          </div>

          {/* Branchen */}
          <div>
            <Label className="text-sm font-medium">
              {t("icp.industries.label")}
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {industryOptions.map(industry => (
                <Badge
                  key={industry}
                  variant={
                    profile.industries.includes(industry)
                      ? "default"
                      : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleIndustry(industry)}
                >
                  {industry}
                </Badge>
              ))}
            </div>
          </div>

          {/* Unternehmensgröße */}
          <div>
            <Label className="text-sm font-medium">
              {t("icp.companySize")}
            </Label>
            <Select
              value={profile.companySizeRange}
              onValueChange={value =>
                setProfile(prev => ({ ...prev, companySizeRange: value }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SIZE_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}{" "}
                    {language === "de"
                      ? t("icp.companySize.employeesDe")
                      : t("icp.companySize.employeesEn")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Länder */}
          <div>
            <Label className="text-sm font-medium">
              {t("icp.locations.label")}
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {profile.locations.map(location => (
                <Badge key={location} variant="secondary" className="gap-1">
                  <Globe className="w-3 h-3" />
                  {location}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => removeLocation(location)}
                  />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder={t("icp.locations.placeholder")}
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                onKeyPress={e => e.key === "Enter" && addLocation(newLocation)}
              />
              <Button onClick={() => addLocation(newLocation)} size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {locationOptions
                .filter(loc => !profile.locations.includes(loc))
                .slice(0, 5)
                .map(location => (
                  <Badge
                    key={location}
                    variant="outline"
                    className="cursor-pointer text-xs"
                    onClick={() => addLocation(location)}
                  >
                    {location}
                  </Badge>
                ))}
            </div>
          </div>

          {/* Business Description */}
          <div>
            <Label className="text-sm font-medium">
              {t("icp.businessDescription")}
            </Label>
            <Textarea
              placeholder={t("icp.businessDescription.placeholder")}
              value={profile.businessDescription}
              onChange={e =>
                setProfile(prev => ({
                  ...prev,
                  businessDescription: e.target.value,
                }))
              }
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Ideal Customer */}
          <div>
            <Label className="text-sm font-medium">
              {t("icp.idealCustomer")}
            </Label>
            <Textarea
              placeholder={t("icp.idealCustomer.placeholder")}
              value={profile.idealCustomer}
              onChange={e =>
                setProfile(prev => ({ ...prev, idealCustomer: e.target.value }))
              }
              className="mt-2"
              rows={3}
            />
          </div>

          {/* Live Preview */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4" />
                <Label className="text-sm font-medium">
                  {t("icp.preview.title")}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {getPreviewText()}
              </p>
            </CardContent>
          </Card>

          {isSaving && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {t("icp.saving")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
