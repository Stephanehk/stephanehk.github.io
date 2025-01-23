---
title: "Influencing Humans to Conform to Preference Models for RLHF"
collection: publications
permalink: /publication/2023-08-03-paper-title-number-4
# excerpt: 'This paper is about fixing template issue #693.'
# date: 2024-02-17
venue: 'Arxiv Preprint'
paperurl: 'https://arxiv.org/pdf/2501.06416'
# citation: 'Your Name, You. (2024). &quot;Paper Title Number 3.&quot; <i>GitHub Journal of Bugs</i>. 1(3).'
---
By Stephane Hatgis-Kessell, W. Bradley Knox, Serena Booth, Scott Niekum, Peter Stone

**Abstract**

Designing a reinforcement learning from human feedback (RLHF) algorithm to approximate a human's unobservable reward function  requires assuming, implicitly or explicitly, a model of human preferences.  A preference model that poorly describes how humans generate preferences risks learning a poor approximation of the human’s reward function. In this paper, we conduct three human studies to assess whether one can influence the expression of real human preferences to more closely conform to a desired preference model. Importantly, our approach does not seek to alter the human's unobserved reward function. Rather, we change how humans use this reward function to generate preferences, such that they better match whatever preference model is assumed by a particular RLHF algorithm. We introduce three interventions: showing humans the quantities that underlie a preference model, which is normally unobservable information derived from the reward function; training people to follow a specific preference model; and modifying the preference elicitation question. All intervention types show significant effects, providing practical tools to improve preference data quality and the resultant alignment of learned reward functions. Overall we establish a novel research direction in model alignment: designing interfaces and training interventions to increase human conformance with the modeling assumptions of the algorithm that will learn from their input.