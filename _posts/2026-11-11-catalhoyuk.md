---
title: 'Çatalhöyük'
date: 2026-11-11
permalink: /posts/2026/11/catalhoyuk/
excerpt: 'A walk through the Neolithic town of Çatalhöyük, c. 6600 BCE.'
---

Çatalhöyük is a neolithic settlement that lasted for ~1,100 years, from 7100 to 6000 BCE. The people of Çatalhöyük appear to have no social hierarchy, little evidence of division of labor or market economy, no army or fortifications, and no official government.

They had no known public buildings, streets, or formal institutions; houses were accessible through hatches in rooftops, all connected to each other in a honeycomb fashion. Houses were similar in size and men and women ate similar diets and had similar workloads, suggesting a broadly egalitarian, gender-equal society.

They serve as a millennium-long counterexample to Hobbes's claim that social order requires a Leviathan, and potentially to what "human nature" means.

<div class="catalhoyuk-embed">
  <iframe src="/catalhoyuk/" title="Çatalhöyük walkthrough" allow="pointer-lock; fullscreen" allowfullscreen loading="eager"></iframe>
</div>

<style>
  .catalhoyuk-embed { position: relative; z-index: 3; width: 100%; margin-top: 1.5em; height: 88vh; min-height: 480px; background: #000; }
  .catalhoyuk-embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
  /* the sidebar's skater walks behind the simulation on this page, not over it */
  #hz-stage { z-index: -1; }
</style>
<script>
  (function () {
    var el = document.querySelector('.catalhoyuk-embed');
    function fit() {
      el.style.width = '100%';
      if (window.innerWidth >= 925) el.style.width = (window.innerWidth - el.getBoundingClientRect().left) + 'px';
    }
    fit(); window.addEventListener('resize', fit); window.addEventListener('load', fit);
  })();
</script>
