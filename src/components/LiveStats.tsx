'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface LiveStatsData {
  productsCount: number;
  modulesCount: number;
}

export default function LiveStats() {
  const [stats, setStats] = useState<LiveStatsData>({
    productsCount: 5,
    modulesCount: 45,
  });

  const fetchStats = useCallback(async () => {
    try {
      const supabase = createClient();

      // Fetch projects count
      const { count: projectsCount } = await supabase
        .from('zo_projects')
        .select('project_id', { count: 'exact', head: true });

      // Fetch builder modules count
      const { count: modulesCount } = await supabase
        .from('zo_builder_modules')
        .select('id', { count: 'exact', head: true });

      setStats({
        productsCount: projectsCount ?? 5,
        modulesCount: modulesCount ?? 45,
      });
    } catch (e) {
      console.log('Stats fetch skipped:', e);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="hero-stats">
      <div className="stat">
        <div className="stat-value">8</div>
        <div className="stat-label">AI Minds</div>
      </div>
      <div className="stat">
        <div className="stat-value">{stats.modulesCount}+</div>
        <div className="stat-label">Knowledge Modules</div>
      </div>
      <div className="stat">
        <div className="stat-value">{stats.productsCount}</div>
        <div className="stat-label">Products</div>
      </div>
      <div className="stat">
        <div className="stat-value">$0.45</div>
        <div className="stat-label">Per Cycle</div>
      </div>
    </div>
  );
}
