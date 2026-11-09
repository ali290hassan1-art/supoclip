"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { fetchGenerations, formatClipDuration, type GenerationSummary } from "@/lib/generations";
import { getClipUrl } from "@/lib/clip-actions";
import DynamicVideoPlayer from "@/components/dynamic-video-player";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  Clapperboard, Download, Flame, Loader2, Play, Plus,
  Scissors, Search, Sparkles, Video, Calendar, Clock,
  ExternalLink, Film
} from "lucide-react";

interface StudioClip {
  id: string;
  task_id: string;
  filename: string;
  virality_score: number;
  hook_title: string | null;
  duration: number;
  start_time: string;
  end_time: string;
  video_url: string;
}

interface TaskWithClips extends GenerationSummary {
  clips: StudioClip[];
  isLoadingClips?: boolean;
}

export default function StudioPage() {
  const { data: session } = useSession();
  const [tasks, setTasks] = useState<TaskWithClips[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeClip, setActiveClip] = useState<{ clip: StudioClip; taskTitle: string } | null>(null);

  useEffect(() => {
    async function loadStudioData() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const generationSummaries = await fetchGenerations();
        
        // Initialize tasks
        const initialTasks: TaskWithClips[] = generationSummaries.map((gen) => ({
          ...gen,
          clips: [],
          isLoadingClips: true,
        }));
        setTasks(initialTasks);
        setIsLoading(false);

        // Fetch clips for each task in parallel
        const loadedTasks = await Promise.all(
          generationSummaries.map(async (gen) => {
            try {
              const res = await fetch(`/api/tasks/${gen.id}/clips`, { cache: "no-store" });
              if (res.ok) {
                const data = await res.json();
                return {
                  ...gen,
                  clips: (data.clips || []) as StudioClip[],
                  isLoadingClips: false,
                };
              }
            } catch (err) {
              console.error(`Failed to load clips for task ${gen.id}:`, err);
            }
            return { ...gen, clips: [], isLoadingClips: false };
          })
        );

        setTasks(loadedTasks);
      } catch (err) {
        console.error("Failed to load studio tasks:", err);
        setIsLoading(false);
      }
    }

    void loadStudioData();
  }, [session?.user?.id]);

  // Group tasks by Date (Today, Yesterday, Older)
  const groupedTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: {
      today: TaskWithClips[];
      yesterday: TaskWithClips[];
      earlier: TaskWithClips[];
    } = { today: [], yesterday: [], earlier: [] };

    const filtered = tasks.filter((task) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = (task.source_title || "").toLowerCase().includes(q);
      const matchClip = task.clips.some((c) => (c.hook_title || "").toLowerCase().includes(q));
      return matchTitle || matchClip;
    });

    for (const task of filtered) {
      const taskDate = new Date(task.created_at);
      const taskDay = new Date(taskDate);
      taskDay.setHours(0, 0, 0, 0);

      if (taskDay.getTime() === today.getTime()) {
        groups.today.push(task);
      } else if (taskDay.getTime() === yesterday.getTime()) {
        groups.yesterday.push(task);
      } else {
        groups.earlier.push(task);
      }
    }

    return groups;
  }, [tasks, searchQuery]);

  const totalClipsCount = useMemo(() => {
    return tasks.reduce((sum, t) => sum + (t.clips.length || t.clips_count || 0), 0);
  }, [tasks]);

  const highestScore = useMemo(() => {
    let max = 0;
    for (const t of tasks) {
      for (const c of t.clips) {
        if (c.virality_score > max) max = c.virality_score;
      }
      if ((t.top_virality_score || 0) > max) max = t.top_virality_score || 0;
    }
    return max;
  }, [tasks]);

  const formatTaskTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatTaskFullDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Clapperboard className="size-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight">Creator Studio</h1>
              <p className="text-sm text-muted-foreground">
                All generated videos and viral clips organized by date and time.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild className="gap-2">
            <Link href="/">
              <Plus className="size-4" />
              New Generation
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Videos</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{tasks.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Clips Generated</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{totalClipsCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Highest Virality</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-brand flex items-center gap-1.5">
            {highestScore > 0 ? (
              <>
                <Flame className="size-5 fill-current" />
                {highestScore}
              </>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 flex flex-col justify-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search clips & titles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-brand" />
          <p className="text-sm font-medium">Loading your Studio...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center flex flex-col items-center justify-center gap-4">
          <div className="size-14 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Film className="size-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">No videos generated yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Paste a YouTube link or upload a video on the Create page to generate your first viral clips.
            </p>
          </div>
          <Button asChild className="gap-2">
            <Link href="/">
              <Sparkles className="size-4" />
              Generate Your First Video
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-10">
          {/* Section: Today */}
          {groupedTasks.today.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Calendar className="size-4 text-brand" />
                <h2 className="text-lg font-bold font-display">Today (Aaj)</h2>
                <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                  {groupedTasks.today.length} video{groupedTasks.today.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-6">
                {groupedTasks.today.map((task) => (
                  <StudioVideoCard
                    key={task.id}
                    task={task}
                    formatTime={formatTaskTime}
                    onPlayClip={(clip, taskTitle) => setActiveClip({ clip, taskTitle })}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section: Yesterday */}
          {groupedTasks.yesterday.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Calendar className="size-4 text-muted-foreground" />
                <h2 className="text-lg font-bold font-display">Yesterday (Kal)</h2>
                <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                  {groupedTasks.yesterday.length} video{groupedTasks.yesterday.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-6">
                {groupedTasks.yesterday.map((task) => (
                  <StudioVideoCard
                    key={task.id}
                    task={task}
                    formatTime={formatTaskTime}
                    onPlayClip={(clip, taskTitle) => setActiveClip({ clip, taskTitle })}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Section: Earlier */}
          {groupedTasks.earlier.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                <Calendar className="size-4 text-muted-foreground" />
                <h2 className="text-lg font-bold font-display">Earlier (Pichle Din)</h2>
                <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                  {groupedTasks.earlier.length} video{groupedTasks.earlier.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-6">
                {groupedTasks.earlier.map((task) => (
                  <StudioVideoCard
                    key={task.id}
                    task={task}
                    formatTime={formatTaskFullDate}
                    onPlayClip={(clip, taskTitle) => setActiveClip({ clip, taskTitle })}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Full-Screen Video Playback Modal */}
      <Dialog open={activeClip !== null} onOpenChange={(open) => !open && setActiveClip(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-stone-950 text-white border-stone-800">
          {activeClip && (
            <div className="grid md:grid-cols-[1fr_320px] max-h-[85vh]">
              {/* Video Player */}
              <div className="flex items-center justify-center p-4 bg-black/60">
                <DynamicVideoPlayer
                  key={activeClip.clip.id}
                  src={getClipUrl(activeClip.clip.video_url, activeClip.clip.filename)}
                  autoPlay
                  className="max-h-[70vh] aspect-[9/16] rounded-xl shadow-2xl"
                />
              </div>

              {/* Clip Sidebar Details */}
              <div className="p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-white/10 bg-stone-900/90 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand/20 text-brand px-2.5 py-0.5 text-xs font-bold">
                      <Flame className="size-3.5 fill-current" />
                      Virality Score {activeClip.clip.virality_score}
                    </span>
                    <DialogTitle className="text-lg font-bold font-display mt-2 leading-snug">
                      {activeClip.clip.hook_title || "Generated Clip"}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-stone-400 mt-1">
                      From: {activeClip.taskTitle}
                    </DialogDescription>
                  </div>

                  <div className="rounded-lg bg-white/5 p-3 text-xs space-y-1.5 border border-white/10">
                    <div className="flex justify-between">
                      <span className="text-stone-400">Duration:</span>
                      <span className="font-semibold tabular-nums">{formatClipDuration(activeClip.clip.duration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">Time Range:</span>
                      <span className="font-semibold tabular-nums">{activeClip.clip.start_time} – {activeClip.clip.end_time}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-400">Format:</span>
                      <span className="font-semibold">9:16 Vertical (HD)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 space-y-2.5">
                  <Button asChild className="w-full gap-2">
                    <a
                      href={getClipUrl(activeClip.clip.video_url, activeClip.clip.filename)}
                      download={activeClip.clip.filename}
                    >
                      <Download className="size-4" />
                      Download MP4 Clip
                    </a>
                  </Button>

                  <Button asChild variant="outline" className="w-full gap-2 text-xs border-white/20 hover:bg-white/10">
                    <Link href={`/tasks/${activeClip.clip.task_id}/edit?clip=${activeClip.clip.id}`}>
                      <Scissors className="size-3.5" />
                      Edit Subtitles & Restyle
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudioVideoCard({
  task,
  formatTime,
  onPlayClip,
}: {
  task: TaskWithClips;
  formatTime: (d: string) => string;
  onPlayClip: (clip: StudioClip, taskTitle: string) => void;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4 hover:border-foreground/20 transition-all">
      {/* Video Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
            <Video className="size-4" />
          </div>
          <div>
            <Link
              href={`/tasks/${task.id}`}
              className="font-semibold hover:underline flex items-center gap-1.5 text-base leading-snug"
            >
              {task.source_title || "Untitled Video"}
              <ExternalLink className="size-3.5 text-muted-foreground opacity-60" />
            </Link>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatTime(task.created_at)}
              </span>
              <span>·</span>
              <span className="tabular-nums font-medium text-foreground">
                {task.clips.length || task.clips_count || 0} clips generated
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button asChild size="sm" variant="outline" className="h-8 text-xs gap-1.5">
            <Link href={`/tasks/${task.id}`}>
              View Task
            </Link>
          </Button>
        </div>
      </div>

      {/* Rendered Clips Horizontal / Grid View */}
      {task.isLoadingClips ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="size-3.5 animate-spin" />
          Loading clips...
        </div>
      ) : task.clips.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">No clips rendered yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pt-1">
          {task.clips.map((clip, idx) => (
            <div
              key={clip.id}
              className="group relative flex flex-col rounded-xl border bg-muted/20 overflow-hidden hover:shadow-md transition-all"
            >
              {/* Thumbnail / Preview Area */}
              <div
                onClick={() => onPlayClip(clip, task.source_title)}
                className="relative aspect-[9/16] bg-stone-900 cursor-pointer overflow-hidden flex items-center justify-center"
              >
                <video
                  src={`${getClipUrl(clip.video_url, clip.filename)}#t=0.5`}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                {/* Overlay gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                {/* Virality Score Badge */}
                {clip.virality_score > 0 && (
                  <span className="absolute top-2 right-2 rounded-full bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold text-white flex items-center gap-1 shadow">
                    <Flame className="size-3 text-orange-400 fill-orange-400" />
                    {clip.virality_score}
                  </span>
                )}

                {/* Duration */}
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
                  {formatClipDuration(clip.duration)}
                </span>

                {/* Play Button Icon on Hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <span className="flex size-10 items-center justify-center rounded-full bg-white text-black shadow-lg">
                    <Play className="size-5 fill-current ml-0.5" />
                  </span>
                </div>
              </div>

              {/* Meta / Title */}
              <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                <div>
                  <p className="text-xs font-semibold line-clamp-2 leading-tight">
                    {clip.hook_title || `Clip #${idx + 1}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                    {clip.start_time} – {clip.end_time}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 flex-1 text-[11px] gap-1 px-2"
                    onClick={() => onPlayClip(clip, task.source_title)}
                  >
                    <Play className="size-3 fill-current" />
                    Play
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    asChild
                    title="Download Clip"
                  >
                    <a
                      href={getClipUrl(clip.video_url, clip.filename)}
                      download={clip.filename}
                    >
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
