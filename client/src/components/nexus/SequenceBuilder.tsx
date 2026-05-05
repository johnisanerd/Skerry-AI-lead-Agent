import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Play, Pause, Trash2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useLanguageStore, useT } from "@/lib/i18n";

interface SequenceStep {
  stepNumber: number;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
  condition: "always" | "no_reply" | "no_open";
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  isActive: boolean;
}

export function SequenceBuilder() {
  const t = useT();
  const language = useLanguageStore(s => s.language);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSequenceName, setNewSequenceName] = useState("");
  const workspaceId = useWorkspaceStore(s => s.currentId);
  const workspaceHeaders: Record<string, string> = workspaceId
    ? { "x-workspace-id": workspaceId }
    : {};

  const conditionOptions = [
    { value: "always", label: t("sequences.always") },
    { value: "no_reply", label: t("sequences.noReply") },
    { value: "no_open", label: t("sequences.noOpen") },
  ] as const;

  const templateVariables = [
    { var: "{{first_name}}", desc: t("sequences.firstName") },
    { var: "{{last_name}}", desc: t("sequences.lastName") },
    { var: "{{company}}", desc: t("sequences.company") },
    { var: "{{title}}", desc: t("sequences.jobTitle") },
    {
      var: "{{business_description}}",
      desc: t("sequences.businessDescription"),
    },
    { var: "{{sender_name}}", desc: t("sequences.senderName") },
  ] as const;

  const makeDefaultStep = (stepNumber: number): SequenceStep => {
    if (language === "de") {
      return {
        stepNumber,
        delayDays: stepNumber === 1 ? 0 : 3,
        subjectTemplate:
          stepNumber === 1 ? "Re: {{first_name}}" : `Nachfassen #${stepNumber}`,
        bodyTemplate:
          stepNumber === 1
            ? `Hi {{first_name}},

{{business_description}} könnte für {{company}} interessant sein.

Hätten Sie 15 Minuten für ein kurzes Gespräch?

Viele Grüße,
{{sender_name}}`
            : `Hi {{first_name}},

Ich wollte nur nachhaken.

Viele Grüße,
{{sender_name}}`,
        condition: stepNumber === 1 ? "always" : "no_reply",
      };
    }

    return {
      stepNumber,
      delayDays: stepNumber === 1 ? 0 : 3,
      subjectTemplate:
        stepNumber === 1 ? "Re: {{first_name}}" : `Follow-up #${stepNumber}`,
      bodyTemplate:
        stepNumber === 1
          ? `Hi {{first_name}},

{{business_description}} might be relevant for {{company}}.

Would you have 15 minutes for a quick chat?

Best,
{{sender_name}}`
          : `Hi {{first_name}},

Just following up here.

Best,
{{sender_name}}`,
      condition: stepNumber === 1 ? "always" : "no_reply",
    };
  };

  const [newSteps, setNewSteps] = useState<SequenceStep[]>([
    makeDefaultStep(1),
  ]);

  // Load sequences
  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    try {
      const res = await fetch("/api/sequences", {
        credentials: "include",
        headers: workspaceHeaders,
      });
      const data = await res.json();
      if (data.ok) {
        setSequences(data.sequences || []);
      }
    } catch (err) {
      console.error("Failed to load sequences:", err);
    }
  };

  const addStep = () => {
    const nextStepNumber = Math.max(...newSteps.map(s => s.stepNumber), 0) + 1;
    setNewSteps([...newSteps, makeDefaultStep(nextStepNumber)]);
  };

  const removeStep = (stepNumber: number) => {
    setNewSteps(newSteps.filter(s => s.stepNumber !== stepNumber));
  };

  const updateStep = (stepNumber: number, updates: Partial<SequenceStep>) => {
    setNewSteps(
      newSteps.map(s =>
        s.stepNumber === stepNumber ? { ...s, ...updates } : s
      )
    );
  };

  const createSequence = async () => {
    if (!newSequenceName.trim()) {
      toast.error(t("sequences.nameRequired"));
      return;
    }

    if (newSteps.length === 0) {
      toast.error(t("sequences.stepRequired"));
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        credentials: "include",
        body: JSON.stringify({
          name: newSequenceName.trim(),
          steps: newSteps,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("sequences.created"));
        setNewSequenceName("");
        setNewSteps([makeDefaultStep(1)]);
        loadSequences();
      } else {
        toast.error(data.error || t("sequences.error"));
      }
    } catch (err) {
      toast.error(t("common.serverError"));
    } finally {
      setIsCreating(false);
    }
  };

  const enrollLeadInSequence = async (sequenceId: string, leadId: string) => {
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...workspaceHeaders },
        credentials: "include",
        body: JSON.stringify({ leadId }),
      });

      const data = await res.json();
      if (data.ok) {
        toast.success(t("sequences.enrolled"));
      } else {
        toast.error(data.error || t("sequences.enrollError"));
      }
    } catch (err) {
      toast.error(t("common.serverError"));
    }
  };

  const getConditionLabel = (value: SequenceStep["condition"]) => {
    return (
      conditionOptions.find(option => option.value === value)?.label ??
      String(value)
    );
  };

  return (
    <div className="space-y-6">
      {/* Create New Sequence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {t("sequences.createSequence")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sequence-name">{t("sequences.nameLabel")}</Label>
            <Input
              id="sequence-name"
              placeholder={t("sequences.namePlaceholder")}
              value={newSequenceName}
              onChange={e => setNewSequenceName(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t("sequences.steps")}</Label>
              <Button onClick={addStep} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                {t("sequences.addStep")}
              </Button>
            </div>

            {newSteps.map(step => (
              <Card
                key={step.stepNumber}
                className="border-l-4 border-l-purple-500"
              >
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">
                      {t("sequences.stepNumber")} {step.stepNumber}
                    </h4>
                    <Button
                      onClick={() => removeStep(step.stepNumber)}
                      size="sm"
                      variant="ghost"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label>{t("sequences.delayDays")}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={step.delayDays}
                        onChange={e =>
                          updateStep(step.stepNumber, {
                            delayDays: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>{t("sequences.condition")}</Label>
                      <Select
                        value={step.condition}
                        onValueChange={(value: any) =>
                          updateStep(step.stepNumber, {
                            condition: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {conditionOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("sequences.subject")}</Label>
                    <Input
                      placeholder={t("sequences.subjectPlaceholder")}
                      value={step.subjectTemplate}
                      onChange={e =>
                        updateStep(step.stepNumber, {
                          subjectTemplate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("sequences.body")}</Label>
                    <Textarea
                      placeholder={t("sequences.bodyPlaceholder")}
                      rows={6}
                      value={step.bodyTemplate}
                      onChange={e =>
                        updateStep(step.stepNumber, {
                          bodyTemplate: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {templateVariables.map(variable => (
                      <Badge
                        key={variable.var}
                        variant="outline"
                        className="text-xs cursor-pointer"
                        onClick={() => {
                          const currentSubject = step.subjectTemplate;
                          const currentBody = step.bodyTemplate;
                          updateStep(step.stepNumber, {
                            subjectTemplate:
                              currentSubject + " " + variable.var,
                            bodyTemplate: currentBody + " " + variable.var,
                          });
                        }}
                      >
                        {variable.var}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Button
            onClick={createSequence}
            disabled={isCreating || !newSequenceName.trim()}
            className="w-full"
          >
            {isCreating
              ? t("sequences.creating")
              : t("sequences.createSequence")}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Sequences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t("sequences.activeTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {t("sequences.noSequences")}
            </p>
          ) : (
            <div className="space-y-4">
              {sequences.map(sequence => (
                <Card
                  key={sequence.id}
                  className="border-l-4 border-l-green-500"
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium">{sequence.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {sequence.steps.length} {t("sequences.steps")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Play className="w-4 h-4 mr-1" />
                          {t("sequences.enrollLead")}
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {sequence.steps.map(step => (
                        <div
                          key={step.stepNumber}
                          className="flex items-center gap-4 text-sm"
                        >
                          <Badge variant="secondary">
                            {t("sequences.stepNumber")} {step.stepNumber}
                          </Badge>
                          <span className="text-muted-foreground">
                            {step.delayDays === 0
                              ? t("sequences.immediate")
                              : `+${step.delayDays} ${t("sequences.days")}`}
                          </span>
                          <span className="font-medium truncate">
                            {step.subjectTemplate}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {getConditionLabel(step.condition)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
