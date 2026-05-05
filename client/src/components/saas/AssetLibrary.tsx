import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Download,
  Upload,
  Plus,
  Edit,
  Trash2,
  Eye,
  Copy,
  FileText,
  Image,
  Video,
  FileAudio,
  FileVideo,
  Archive,
  Star,
  MoreVertical,
} from "lucide-react";
import { useT } from "@/lib/i18n";

interface Asset {
  id: string;
  name: string;
  type: "template" | "image" | "video" | "document" | "audio";
  category: "email" | "landing" | "social" | "offer";
  content: string;
  description?: string;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  fileUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  duration?: number;
}

interface Offer {
  id: string;
  name: string;
  type: "discount" | "bundle" | "trial" | "upgrade";
  value: string;
  description: string;
  conditions: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageCount: number;
  conversionRate: number;
  createdAt: string;
}

export function AssetLibrary() {
  const t = useT();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    loadAssets();
    loadOffers();
  }, []);

  const loadAssets = async () => {
    try {
      const res = await fetch("/api/assets", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setAssets(data.assets);
      }
    } catch (err) {
      toast.error(t("asset.loadError"));
    }
  };

  const loadOffers = async () => {
    try {
      const res = await fetch("/api/offers", { credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setOffers(data.offers);
      }
    } catch (err) {
      toast.error(t("offer.loadError"));
    }
  };

  const uploadAsset = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    formData.append("type", "asset");
    formData.append("category", "email");

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/assets/upload");
      xhr.withCredentials = true;

      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      };

      xhr.onload = () => {
        setIsUploading(false);
        setUploadProgress(0);
        if (xhr.status === 200) {
          toast.success(t("asset.uploaded"));
          loadAssets();
        } else {
          toast.error(t("asset.uploadError"));
        }
      };

      xhr.onerror = () => {
        setIsUploading(false);
        setUploadProgress(0);
        toast.error(t("asset.uploadError"));
      };

      xhr.send(formData);
    } catch (err) {
      setIsUploading(false);
      setUploadProgress(0);
      toast.error(t("asset.uploadError"));
    }
  };

  const createOffer = async () => {
    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: t("offer.defaultName"),
          type: "discount",
          value: "10%",
          description: t("offer.defaultDescription"),
          conditions: [t("offer.defaultCondition")],
          startDate: new Date().toISOString(),
          endDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("offer.created"));
        loadOffers();
      } else {
        toast.error(data.error || t("offer.createError"));
      }
    } catch (err) {
      toast.error(t("offer.createError"));
    }
  };

  const duplicateAsset = async (assetId: string) => {
    try {
      const res = await fetch(`/api/assets/${assetId}/duplicate`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("asset.duplicated"));
        loadAssets();
      } else {
        toast.error(data.error || t("asset.duplicateError"));
      }
    } catch (err) {
      toast.error(t("asset.duplicateError"));
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!confirm(t("asset.confirmDelete"))) {
      return;
    }

    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("asset.deleted"));
        loadAssets();
        setSelectedAsset(null);
      } else {
        toast.error(data.error || t("asset.deleteError"));
      }
    } catch (err) {
      toast.error(t("asset.deleteError"));
    }
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      template: FileText,
      image: Image,
      video: FileVideo,
      document: FileText,
      audio: FileAudio,
    } as const;

    return icons[type as keyof typeof icons] || FileText;
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      email: FileText,
      landing: Image,
      social: Video,
      offer: Star,
    } as const;

    return icons[category as keyof typeof icons] || FileText;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return t("common.unknown");

    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    const sizeStr = size.toFixed(2) + " " + sizes[i];

    return sizeStr;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "0:00";

    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch =
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.tags.some(tag =>
        tag.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesCategory =
      categoryFilter === "all" || asset.category === categoryFilter;
    const matchesType = typeFilter === "all" || asset.type === typeFilter;
    return matchesSearch && matchesCategory && matchesType;
  });

  const filteredOffers = offers.filter(
    offer =>
      offer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      offer.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Asset Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="w-5 h-5" />
            {t("asset.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Section */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-3">{t("asset.upload")}</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="asset-upload">{t("asset.selectFile")}</Label>
                <Input
                  id="asset-upload"
                  type="file"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadAsset(file);
                    }
                  }}
                  accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.mp4,.mp3"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>{t("asset.supportedFormats")}</p>
                <p>{t("asset.maxFileSize")}: 10MB</p>
              </div>
            </div>

            {isUploading && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>{t("asset.uploading")}...</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-muted-foreground mt-1">
                  {uploadProgress}% {t("asset.complete")}
                </p>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("asset.searchAssets")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("asset.filterByCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="email">
                    {t("asset.category.email")}
                  </SelectItem>
                  <SelectItem value="landing">
                    {t("asset.category.landing")}
                  </SelectItem>
                  <SelectItem value="social">
                    {t("asset.category.social")}
                  </SelectItem>
                  <SelectItem value="offer">
                    {t("asset.category.offer")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("asset.filterByType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("common.all")}</SelectItem>
                  <SelectItem value="template">
                    {t("asset.type.template")}
                  </SelectItem>
                  <SelectItem value="image">{t("asset.type.image")}</SelectItem>
                  <SelectItem value="video">{t("asset.type.video")}</SelectItem>
                  <SelectItem value="document">
                    {t("asset.type.document")}
                  </SelectItem>
                  <SelectItem value="audio">{t("asset.type.audio")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assets Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map(asset => (
              <Card
                key={asset.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {React.createElement(getTypeIcon(asset.type), {
                        className: "w-4 h-4",
                      })}
                      <h4 className="font-semibold">{asset.name}</h4>
                      <Badge variant="outline" className="ml-2">
                        {t(`asset.category.${asset.category}`)}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedAsset(asset)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {t("common.view")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => duplicateAsset(asset.id)}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        {t("asset.duplicate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAsset(asset.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-2">
                    {asset.description}
                  </div>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {asset.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div>
                      {t("asset.usage")}: {asset.usageCount} •{" "}
                      {t("asset.createdAt")}:{" "}
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-2">
                      {asset.fileSize && (
                        <span>{formatFileSize(asset.fileSize)}</span>
                      )}
                      {asset.duration && (
                        <span>{formatDuration(asset.duration)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredAssets.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Archive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("asset.noAssets")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Offers Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            {t("offer.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 mb-4">
            <Button onClick={createOffer}>
              <Plus className="w-4 h-4 mr-2" />
              {t("offer.create")}
            </Button>
          </div>

          {/* Offers List */}
          <div className="space-y-3">
            {filteredOffers.map(offer => (
              <Card key={offer.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold">{offer.name}</h4>
                      <Badge variant={offer.isActive ? "default" : "secondary"}>
                        {offer.isActive
                          ? t("common.active")
                          : t("common.inactive")}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("offer.type")}: {t(`offer.type.${offer.type}`)} •{" "}
                      {t("offer.value")}: {offer.value}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("offer.conversionRate")}: {offer.conversionRate}%
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("offer.usage")}: {offer.usageCount}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("offer.duration")}:{" "}
                      {new Date(offer.startDate).toLocaleDateString()} -{" "}
                      {new Date(offer.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOffer(offer)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      {t("common.view")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Toggle offer active/inactive
                      }}
                    >
                      {offer.isActive
                        ? t("common.deactivate")
                        : t("common.activate")}
                    </Button>
                  </div>
                </div>

                {/* Offer Conditions */}
                <div className="mt-3 p-3 bg-muted rounded">
                  <div className="text-sm">
                    <strong>{t("offer.conditions")}:</strong>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {offer.conditions.map((condition, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            {filteredOffers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Star className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("offer.noOffers")}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {React.createElement(getTypeIcon(selectedAsset.type), {
                    className: "w-5 h-5",
                  })}
                  {t("asset.details")} - {selectedAsset.name}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAsset(null)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("asset.name")}</Label>
                  <Input value={selectedAsset.name} readOnly />
                </div>
                <div>
                  <Label>{t("asset.type")}</Label>
                  <Input
                    value={t(`asset.type.${selectedAsset.type}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("asset.category")}</Label>
                  <Input
                    value={t(`asset.category.${selectedAsset.category}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("asset.usage")}</Label>
                  <Input value={selectedAsset.usageCount.toString()} readOnly />
                </div>
                <div>
                  <Label>{t("asset.createdAt")}</Label>
                  <Input
                    value={new Date(selectedAsset.createdAt).toLocaleString()}
                    readOnly
                  />
                </div>
                {selectedAsset.fileSize && (
                  <div>
                    <Label>{t("asset.fileSize")}</Label>
                    <Input
                      value={formatFileSize(selectedAsset.fileSize)}
                      readOnly
                    />
                  </div>
                )}
                {selectedAsset.duration && (
                  <div>
                    <Label>{t("asset.duration")}</Label>
                    <Input
                      value={formatDuration(selectedAsset.duration)}
                      readOnly
                    />
                  </div>
                )}
              </div>

              {selectedAsset.description && (
                <div>
                  <Label>{t("asset.description")}</Label>
                  <Textarea value={selectedAsset.description} readOnly />
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                <Label>{t("asset.tags")}</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedAsset.tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  onClick={() => duplicateAsset(selectedAsset.id)}
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t("asset.duplicate")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedAsset.fileUrl) {
                      window.open(selectedAsset.fileUrl, "_blank");
                    }
                  }}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {t("asset.download")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </Card>
      )}

      {/* Offer Detail Modal */}
      {selectedOffer && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  {t("offer.details")} - {selectedOffer.name}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOffer(null)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t("offer.name")}</Label>
                  <Input value={selectedOffer.name} readOnly />
                </div>
                <div>
                  <Label>{t("offer.type")}</Label>
                  <Input
                    value={t(`offer.type.${selectedOffer.type}`)}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("offer.value")}</Label>
                  <Input value={selectedOffer.value} readOnly />
                </div>
                <div>
                  <Label>{t("offer.conversionRate")}</Label>
                  <Input value={`${selectedOffer.conversionRate}%`} readOnly />
                </div>
                <div>
                  <Label>{t("offer.usage")}</Label>
                  <Input value={selectedOffer.usageCount.toString()} readOnly />
                </div>
                <div>
                  <Label>{t("offer.startDate")}</Label>
                  <Input
                    value={new Date(selectedOffer.startDate).toLocaleString()}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("offer.endDate")}</Label>
                  <Input
                    value={new Date(selectedOffer.endDate).toLocaleString()}
                    readOnly
                  />
                </div>
                <div>
                  <Label>{t("offer.status")}</Label>
                  <Input
                    value={
                      selectedOffer.isActive
                        ? t("common.active")
                        : t("common.inactive")
                    }
                    readOnly
                  />
                </div>
              </div>

              {selectedOffer.description && (
                <div>
                  <Label>{t("offer.description")}</Label>
                  <Textarea value={selectedOffer.description} readOnly />
                </div>
              )}

              <div>
                <Label>{t("offer.conditions")}</Label>
                <div className="flex flex-wrap gap-1">
                  {selectedOffer.conditions.map((condition, index) => (
                    <Badge key={index} variant="secondary">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </Card>
      )}
    </div>
  );
}
