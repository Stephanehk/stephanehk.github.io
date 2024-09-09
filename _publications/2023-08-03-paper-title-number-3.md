---
title: "Models of human preference for learning reward functions; a new approach, perspective, and direction for research"
collection: publications
permalink: /publication/2023-08-02-paper-title-number-3
# excerpt: 'This paper is about fixing template issue #693.'
# date: 2024-02-17
venue: 'UT Austin Computer Science Honors Thesis'
paperurl: 'https://stephanehk.github.io/files/Turing_Thesis_Final_.pdf'
# citation: 'Your Name, You. (2024). &quot;Paper Title Number 3.&quot; <i>GitHub Journal of Bugs</i>. 1(3).'
---
By Stephane Hatgis-Kessell
Advisor: Peter Stone

**Abstract**
Awarded Best Computer Science Honors Thesis Award

Poor alignment between the objectives that intelligent agents optimize for and the desires of human stakeholders risks limiting the utility of decision-making systems and may pose dangers to end users. In reinforcement learning, this objective is encoded via a reward function. Manually specifying an aligned reward function is notoriously difficult. Reinforcement learning from human feedback (RLHF) is one approach to address this problem, where a reward function is instead learned from human preferences over trajectory segments. RLHF algorithms, however, require a precise model of human preferences to learn a reward function. What this preference model should be has remained largely unexplored, with most prior work assuming that human preferences arise solely from the sum of rewards along each segment. We find this assumption to be fundamentally flawed and instead assert that human preferences arise from a segment's deviation from optimal behavior. We propose the regret model of human preferences, showing that it is more aligned with human decision-making and leads to more performant learned reward functions. Using these findings we then reframe influential prior work in RLHF and provide a new theoretically principled perspective on past approaches. Finally, we outline an important direction for future research; developing preference elicitation interfaces to subtly guide human preferences towards a specific model and thereby improve reward learning.