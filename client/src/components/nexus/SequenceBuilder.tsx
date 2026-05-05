import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Play, Pause, Trash2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";

interface SequenceStep {
  stepNumber: number;
  delayDays: number;
  subjectTemplate: string;
  bodyTemplate: string;
  condition: 'always' | 'no_reply' | 'no_open';
}

interface Sequence {
  id: string;
  name: string;
  steps: SequenceStep[];
  isActive: boolean;
}

const CONDITION_OPTIONS = [
  { value: 'always', label: 'Immer senden' },
  { value: 'no_reply', label: 'Nur wenn keine Antwort' },
  { value: 'no_open', label: 'Nur wenn nicht geöffnet' },
];

const TEMPLATE_VARIABLES = [
  { var: '{{first_name}}', desc: 'Vorname' },
  { var: '{{last_name}}', desc: 'Nachname' },
  { var: '{{company}}', desc: 'Unternehmen' },
  { var: '{{title}}', desc: 'Position' },
  { var: '{{business_description}}', desc: 'Business-Beschreibung' },
  { var: '{{sender_name}}', desc: 'Absender Name' },
];

export function SequenceBuilder() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSequenceName, setNewSequenceName] = useState("");
  const [newSteps, setNewSteps] = useState<SequenceStep[]>([
    {
      stepNumber: 1,
      delayDays: 0,
      subjectTemplate: "Re: {{first_name}}",
      bodyTemplate: `Hi {{first_name}},

{{business_description}} könnte für {{company}} interessant sein.

Hätten Sie 15 Minuten für ein kurzes Gespräch?

Viele Grüße,
{{sender_name}}`,
      condition: 'always'
    }
  ]);

  // Load sequences
  useEffect(() => {
    loadSequences();
  }, []);

  const loadSequences = async () => {
    try {
      const res = await fetch('/api/sequences', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setSequences(data.sequences || []);
      }
    } catch (err) {
      console.error('Failed to load sequences:', err);
    }
  };

  const addStep = () => {
    const nextStepNumber = Math.max(...newSteps.map(s => s.stepNumber), 0) + 1;
    setNewSteps([...newSteps, {
      stepNumber: nextStepNumber,
      delayDays: 3,
      subjectTemplate: `Follow-up #${nextStepNumber}`,
      bodyTemplate: `Hi {{first_name}},

Ich wollte nur nachhaken.

Viele Grüße,
{{sender_name}}`,
      condition: 'no_reply'
    }]);
  };

  const removeStep = (stepNumber: number) => {
    setNewSteps(newSteps.filter(s => s.stepNumber !== stepNumber));
  };

  const updateStep = (stepNumber: number, updates: Partial<SequenceStep>) => {
    setNewSteps(newSteps.map(s => 
      s.stepNumber === stepNumber ? { ...s, ...updates } : s
    ));
  };

  const createSequence = async () => {
    if (!newSequenceName.trim()) {
      toast.error('Name ist erforderlich');
      return;
    }

    if (newSteps.length === 0) {
      toast.error('Mindestens ein Step ist erforderlich');
      return;
    }

    setIsCreating(true);
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newSequenceName.trim(),
          steps: newSteps
        })
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Sequence erstellt');
        setNewSequenceName("");
        setNewSteps([{
          stepNumber: 1,
          delayDays: 0,
          subjectTemplate: "Re: {{first_name}}",
          bodyTemplate: `Hi {{first_name}},

{{business_description}} könnte für {{company}} interessant sein.

Hätten Sie 15 Minuten für ein kurzes Gespräch?

Viele Grüße,
{{sender_name}}`,
          condition: 'always'
        }]);
        loadSequences();
      } else {
        toast.error(data.error || 'Fehler beim Erstellen');
      }
    } catch (err) {
      toast.error('Verbindung zum Server fehlgeschlagen');
    } finally {
      setIsCreating(false);
    }
  };

  const enrollLeadInSequence = async (sequenceId: string, leadId: string) => {
    try {
      const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ leadId })
      });

      const data = await res.json();
      if (data.ok) {
        toast.success('Lead in Sequence eingeschrieben');
      } else {
        toast.error(data.error || 'Fehler beim Einschreiben');
      }
    } catch (err) {
      toast.error('Verbindung zum Server fehlgeschlagen');
    }
  };

  return (
    <div className="space-y-6">
      {/* Create New Sequence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Neue Sequence erstellen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sequence-name">Sequence Name</Label>
            <Input
              id="sequence-name"
              placeholder="z.B. Standard Follow-up"
              value={newSequenceName}
              onChange={(e) => setNewSequenceName(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Steps</Label>
              <Button onClick={addStep} size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Step hinzufügen
              </Button>
            </div>

            {newSteps.map((step) => (
              <Card key={step.stepNumber} className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Step {step.stepNumber}</h4>
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
                      <Label>Verzögerung (Tage)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={step.delayDays}
                        onChange={(e) => updateStep(step.stepNumber, { 
                          delayDays: parseInt(e.target.value) || 0 
                        })}
                      />
                    </div>
                    <div>
                      <Label>Bedingung</Label>
                      <Select
                        value={step.condition}
                        onValueChange={(value: any) => updateStep(step.stepNumber, { 
                          condition: value 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Betreff</Label>
                    <Input
                      placeholder="Email Betreff mit {{variables}}"
                      value={step.subjectTemplate}
                      onChange={(e) => updateStep(step.stepNumber, { 
                        subjectTemplate: e.target.value 
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email Body (Markdown)</Label>
                    <Textarea
                      placeholder="Email Inhalt mit {{variables}}"
                      rows={6}
                      value={step.bodyTemplate}
                      onChange={(e) => updateStep(step.stepNumber, { 
                        bodyTemplate: e.target.value 
                      })}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1 mt-2">
                    {TEMPLATE_VARIABLES.map(variable => (
                      <Badge
                        key={variable.var}
                        variant="outline"
                        className="text-xs cursor-pointer"
                        onClick={() => {
                          const currentSubject = step.subjectTemplate;
                          const currentBody = step.bodyTemplate;
                          updateStep(step.stepNumber, {
                            subjectTemplate: currentSubject + ' ' + variable.var,
                            bodyTemplate: currentBody + ' ' + variable.var
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
            {isCreating ? "Wird erstellt..." : "Sequence erstellen"}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Sequences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Aktive Sequences
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sequences.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Keine Sequences vorhanden. Erstellen Sie Ihre erste Sequence oben.
            </p>
          ) : (
            <div className="space-y-4">
              {sequences.map((sequence) => (
                <Card key={sequence.id} className="border-l-4 border-l-green-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-medium">{sequence.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {sequence.steps.length} Steps
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Play className="w-4 h-4 mr-1" />
                          Lead einschreiben
                        </Button>
                        <Button size="sm" variant="ghost">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {sequence.steps.map((step) => (
                        <div key={step.stepNumber} className="flex items-center gap-4 text-sm">
                          <Badge variant="secondary">Step {step.stepNumber}</Badge>
                          <span className="text-muted-foreground">
                            {step.delayDays === 0 ? 'Sofort' : `+${step.delayDays} Tage`}
                          </span>
                          <span className="font-medium truncate">
                            {step.subjectTemplate}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {step.condition}
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
