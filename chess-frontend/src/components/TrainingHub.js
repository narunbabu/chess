import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import api from '../services/api';
import {
  SKILL_BANDS,
  canAccessTier,
  getSubscriptionLabel,
  getTrainingDrillsBySkillBand,
} from '../constants/learningCurriculum';

const STORAGE_KEY = 'training_completed_exercises';

const getCompleted = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const TrainingHub = () => {
  const { currentTier } = useSubscription();
  const [completed, setCompleted] = useState(getCompleted);
  const fallbackPaths = useMemo(() => getTrainingDrillsBySkillBand(), []);
  const [skillPaths, setSkillPaths] = useState(fallbackPaths);

  useEffect(() => {
    let cancelled = false;

    const loadDrills = async () => {
      try {
        const response = await api.get('/training/drills');
        const drills = response.data?.data?.drills || [];

        if (cancelled || drills.length === 0) {
          return;
        }

        setSkillPaths(groupServerDrills(drills));
      } catch (error) {
        if (!cancelled) {
          setSkillPaths(fallbackPaths);
        }
      }
    };

    loadDrills();

    return () => {
      cancelled = true;
    };
  }, [fallbackPaths]);

  const toggleComplete = (exercise) => {
    const key = `${exercise.skillBand}-${exercise.id}`;
    setCompleted((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const allDrills = skillPaths.flatMap((path) => path.drills);
  const unlockedDrills = allDrills.filter((drill) => !isDrillLocked(drill, currentTier));
  const isExerciseDone = (exercise) => {
    const key = `${exercise.skillBand}-${exercise.id}`;
    return Boolean(exercise.progress?.is_mastered) || completed.includes(key);
  };
  const completedCount = allDrills.filter(isExerciseDone).length;

  return (
    <div className="training-hub p-6 min-h-screen text-white" style={{ background: '#262421' }}>
      <div className="flex justify-center mb-6">
        <Link
          to="/tutorial"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#312e2b] border border-[#3d3a37] text-[#bababa] hover:text-white hover:border-[#81b64c] transition-all text-sm font-semibold"
        >
          Back to Lessons
        </Link>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Training Drills</h1>
          <p className="text-[#bababa] max-w-3xl">
            Structured practice by player level, with Free, Silver, and Gold access shown directly on each path.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <SummaryCard label="Your tier" value={getSubscriptionLabel(currentTier)} />
          <SummaryCard label="Unlocked drills" value={`${unlockedDrills.length} / ${allDrills.length}`} />
          <SummaryCard label="Completed" value={`${completedCount} / ${allDrills.length}`} />
        </div>

        <div className="mb-8 bg-[#312e2b] border border-[#3d3a37] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-[#bababa] font-semibold">Overall drill progress</span>
            <span className="text-[#81b64c] font-bold">{completedCount} completed</span>
          </div>
          <div className="h-2 bg-[#3d3a37] rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${allDrills.length > 0 ? (completedCount / allDrills.length) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #81b64c, #e8a93e)',
              }}
            />
          </div>
        </div>

        <div className="mb-8">
          <Link
            to="/tactical-trainer"
            className="flex items-center justify-between gap-4 rounded-lg border border-[#81b64c] bg-[#312e2b] px-5 py-4 text-white hover:bg-[#34312e] transition-all"
            style={{ textDecoration: 'none' }}
          >
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#81b64c]">Tactical progression</div>
              <div className="text-base font-bold">Stage-based tactical trainer</div>
              <div className="text-sm text-[#bababa]">Use this for the existing 1600 to 2200 puzzle progression.</div>
            </div>
            <span className="text-[#81b64c] font-bold">Open</span>
          </Link>
        </div>

        <div className="space-y-8">
          {skillPaths.map((path) => {
            const pathLocked = !canAccessTier(currentTier, path.requiredTier);
            return (
              <section key={path.id} className="border-t border-[#3d3a37] pt-6">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h2 className="text-2xl font-bold text-white m-0">{path.label}</h2>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-[#262421] border border-[#3d3a37] text-[#bababa]">
                        {path.ratingRange}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-1 rounded border"
                        style={{
                          borderColor: pathLocked ? '#e8a93e66' : '#81b64c66',
                          color: pathLocked ? '#e8a93e' : '#81b64c',
                          background: pathLocked ? 'rgba(232,169,62,0.08)' : 'rgba(129,182,76,0.08)',
                        }}
                      >
                        {getSubscriptionLabel(path.requiredTier)}
                      </span>
                    </div>
                    <p className="text-[#bababa] m-0 max-w-3xl">{path.focus}</p>
                  </div>
                  <p className="text-[#8b8987] text-sm m-0 lg:text-right">{path.promise}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {path.drills.map((exercise) => {
                    const key = `${exercise.skillBand}-${exercise.id}`;
                    const isDone = isExerciseDone(exercise);
                    const isLocked = isDrillLocked(exercise, currentTier);
                    return (
                      <DrillCard
                        key={key}
                        exercise={exercise}
                        isDone={isDone}
                        isLocked={isLocked}
                        onToggle={() => toggleComplete(exercise)}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const groupServerDrills = (drills) => {
  const normalized = drills.map((drill) => ({
    id: drill.slug,
    dbId: drill.id,
    skillBand: drill.skill_band,
    requiredTier: drill.required_tier,
    type: drill.drill_type,
    theme: drill.theme,
    title: drill.title,
    description: drill.description,
    objective: drill.subtheme || drill.explanation || 'Build reliable chess habits through deliberate repetition.',
    progress: drill.progress,
    isLocked: drill.is_locked,
  }));

  return SKILL_BANDS.map((band) => ({
    ...band,
    drills: normalized.filter((drill) => drill.skillBand === band.id),
  })).filter((band) => band.drills.length > 0);
};

const isDrillLocked = (exercise, currentTier) => {
  if (typeof exercise.isLocked === 'boolean') {
    return exercise.isLocked;
  }

  return !canAccessTier(currentTier, exercise.requiredTier);
};

const SummaryCard = ({ label, value }) => (
  <div className="bg-[#312e2b] border border-[#3d3a37] rounded-lg p-4">
    <div className="text-xs uppercase tracking-wider text-[#8b8987] font-bold mb-1">{label}</div>
    <div className="text-xl font-bold text-white">{value}</div>
  </div>
);

const DrillCard = ({ exercise, isDone, isLocked, onToggle }) => {
  const content = (
    <div
      className="training-card bg-[#312e2b] border rounded-lg p-5 h-full flex flex-col transition-all"
      style={{
        borderColor: isDone ? 'rgba(129,182,76,0.55)' : isLocked ? 'rgba(232,169,62,0.35)' : '#3d3a37',
        opacity: isLocked ? 0.78 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-xs uppercase tracking-wider text-[#81b64c] font-bold">{exercise.type}</span>
        <span className="text-xs text-[#8b8987]">{exercise.theme}</span>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{exercise.title}</h3>
      <p className="text-[#bababa] text-sm mb-4 flex-grow">{exercise.description}</p>
      <div className="text-xs text-[#8b8987] mb-4">{exercise.objective}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-[#bababa]">{getSubscriptionLabel(exercise.requiredTier)}</span>
        <span className={`text-xs font-bold ${isDone ? 'text-[#81b64c]' : 'text-[#8b8987]'}`}>
          {isDone ? 'Completed' : isLocked ? 'Locked' : 'Ready'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="relative">
      {isLocked ? (
        <Link to="/pricing" className="block h-full hover:scale-[1.01] transition-transform" style={{ textDecoration: 'none' }}>
          {content}
        </Link>
      ) : (
        <Link
          to={`/training/${exercise.skillBand}/${exercise.id}`}
          className="block h-full hover:scale-[1.01] transition-transform"
          style={{ textDecoration: 'none' }}
        >
          {content}
        </Link>
      )}
      {!isLocked && (
        <button
          onClick={onToggle}
          className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-bold border"
          style={{
            borderColor: isDone ? '#81b64c' : '#4a4744',
            background: isDone ? 'rgba(129,182,76,0.2)' : 'rgba(0,0,0,0.3)',
            color: isDone ? '#81b64c' : '#8b8987',
          }}
          title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isDone ? 'Done' : 'Mark'}
        </button>
      )}
    </div>
  );
};

export default TrainingHub;
