import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  TrendingUp,
  Users,
  Mail,
  MousePointer,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

interface ABTestResult {
  variantId: string;
  sends: number;
  opens: number;
  clicks: number;
  replies: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  intentScore: number;
}

interface ABTestResultsProps {
  abTestId: string | null;
  workspaceId: string;
}

export function ABTestResults({ abTestId, workspaceId }: ABTestResultsProps) {
  const [results, setResults] = useState<ABTestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasEnoughData, setHasEnoughData] = useState(false);
  const [winnerVariantId, setWinnerVariantId] = useState<string | null>(null);

  useEffect(() => {
    if (abTestId) {
      loadResults();
    }
  }, [abTestId]);

  const loadResults = async () => {
    if (!abTestId) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/ab-tests/${abTestId}/results`, {
        credentials: "include",
        headers: { "x-workspace-id": workspaceId },
      });
      const data = await res.json();

      if (data.ok) {
        setResults(data.results || []);
        setHasEnoughData(data.hasEnoughData || false);
        setWinnerVariantId(data.winnerVariantId || null);
      }
    } catch (err) {
      toast.error("Fehler beim Laden der A/B Test Ergebnisse");
    } finally {
      setIsLoading(false);
    }
  };

  const promoteWinner = async () => {
    if (!winnerVariantId || !abTestId) return;

    try {
      const res = await fetch(`/api/ab-tests/${abTestId}/promote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-workspace-id": workspaceId,
        },
        credentials: "include",
        body: JSON.stringify({ winnerVariantId }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success("Gewinner-Variante wurde promoted");
        loadResults();
      } else {
        toast.error(data.error || "Fehler beim Promoten");
      }
    } catch (err) {
      toast.error("Verbindung zum Server fehlgeschlagen");
    }
  };

  const getVariantColor = (index: number) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
    ];
    return colors[index % colors.length];
  };

  if (!abTestId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Wählen Sie einen A/B Test um die Ergebnisse zu sehen</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Ergebnisse werden geladen...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Keine Ergebnisse verfügbar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxScore = Math.max(...results.map(r => r.intentScore));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            A/B Test Ergebnisse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {results.map((result, index) => (
              <div key={result.variantId} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${getVariantColor(index)}`}
                    ></div>
                    <h4 className="font-medium">Variante {index + 1}</h4>
                    {result.variantId === winnerVariantId && (
                      <Badge variant="default" className="bg-yellow-500">
                        <Trophy className="w-3 h-3 mr-1" />
                        Gewinner
                      </Badge>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {result.intentScore.toFixed(1)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Intent Score
                    </div>
                  </div>
                </div>

                {/* Intent Score Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Intent Score</span>
                    <span>{result.intentScore.toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={(result.intentScore / maxScore) * 100}
                    className="h-2"
                  />
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Mail className="w-4 h-4" />
                      <span className="text-xs">Sends</span>
                    </div>
                    <div className="font-semibold">{result.sends}</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Opens</span>
                    </div>
                    <div className="font-semibold">
                      {result.openRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <MousePointer className="w-4 h-4" />
                      <span className="text-xs">Clicks</span>
                    </div>
                    <div className="font-semibold">
                      {result.clickRate.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs">Replies</span>
                    </div>
                    <div className="font-semibold">
                      {result.replyRate.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Raw Numbers */}
                <div className="text-sm text-muted-foreground">
                  {result.opens} von {result.sends} geöffnet • {result.clicks}{" "}
                  geklickt • {result.replies} geantwortet
                </div>
              </div>
            ))}

            {/* Winner Selection */}
            {hasEnoughData && !winnerVariantId && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Test abschließen?</h4>
                    <p className="text-sm text-muted-foreground">
                      Mit {results.reduce((sum, r) => sum + r.sends, 0)} Sends
                      haben wir aussagekräftige Daten.
                    </p>
                  </div>
                  <Button
                    onClick={promoteWinner}
                    className="bg-yellow-500 hover:bg-yellow-600"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Gewinner promoten
                  </Button>
                </div>
              </div>
            )}

            {!hasEnoughData && (
              <div className="border-t pt-4">
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    Noch nicht genug Daten für aussagekräftige Ergebnisse.
                    Benötigen mindestens 50 Sends gesamt.
                  </p>
                  <p className="text-xs mt-1">
                    Aktuell: {results.reduce((sum, r) => sum + r.sends, 0)}{" "}
                    Sends
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
