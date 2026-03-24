'use client';

import { useEffect } from 'react';

export default function RevealObserver() {
  useEffect(() => {
    // Standard reveal observer
    const observerOptions: IntersectionObserverInit = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach((el) => {
      observer.observe(el);
    });

    // Manifesto block observer
    const manifestoObserverOptions: IntersectionObserverInit = {
      threshold: 0.3,
      rootMargin: '0px 0px -100px 0px',
    };

    const manifestoObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, manifestoObserverOptions);

    document.querySelectorAll('.m-block').forEach((el) => {
      manifestoObserver.observe(el);
    });

    return () => {
      observer.disconnect();
      manifestoObserver.disconnect();
    };
  }, []);

  return null;
}
