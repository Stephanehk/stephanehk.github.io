---
title: "Learning optimal advantage from preferences and mistaking it for reward"
collection: publications
permalink: /publication/2023-08-02-paper-title-number-2
# excerpt: 'This paper is about fixing template issue #693.'
# date: 2024-02-17
venue: 'Proceedings of the AAAI Conference on Artificial Intelligence'
paperurl: 'https://ojs.aaai.org/index.php/AAAI/article/view/28870'
# citation: 'Your Name, You. (2024). &quot;Paper Title Number 3.&quot; <i>GitHub Journal of Bugs</i>. 1(3).'
---
By W. Bradley Knox, Stephane Hatgis-Kessell, Sigurdur Orn Adalgeirsson, Serena Booth, Anca Dragan, Peter Stone,Scott Niekum

(The first two authors contributed equally.)

**Abstract**

We consider algorithms for learning reward functions from human preferences over pairs of trajectory segments, as used in reinforcement learning from human feedback (RLHF). Most recent work assumes that human preferences are generated based only upon the reward accrued within those segments, or their partial return. Recent work casts doubt on the validity of this assumption, proposing an alternative preference model based upon regret. We investigate the consequences of assuming preferences are based upon partial return when they actually arise from regret. We argue that the learned function is an approximation of the optimal advantage function, not a reward function. We find that if a specific pitfall is addressed, this incorrect assumption is not particularly harmful, resulting in a highly shaped reward function. Nonetheless, this incorrect usage of the approximation of the optimal advantage function is less desirable than the appropriate and simpler approach of greedy maximization of it. From the perspective of the regret preference model, we also provide a clearer interpretation of fine tuning contemporary large language models with RLHF. This paper overall provides insight regarding why learning under the partial return preference model tends to work so well in practice, despite it conforming poorly to how humans give preferences.
