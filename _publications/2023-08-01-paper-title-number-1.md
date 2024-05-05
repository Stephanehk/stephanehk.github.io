---
title: "Models of human preference for learning reward functions"
collection: publications
permalink: /publication/2023-08-01-paper-title-number-1
# excerpt: 'This paper is about the number 1. The number 2 is left for future work.'
# date: 2009-10-01
venue: 'Transactions on Machine Learning Research (TMLR)'
paperurl: 'https://arxiv.org/abs/2206.02231'
# citation: 'Your Name, You. (2009). &quot;Paper Title Number 1.&quot; <i>Journal 1</i>. 1(1).'
---
By W. Bradley Knox, Stephane Hatgis-Kessell, Serena Booth, Scott Niekum, Peter Stone, and Alessandro Allievi

(The first two authors contributed equally.)

We have provided our dataset of human preferences between pairs of trajectory segments [here](https://dataverse.tdl.org/dataset.xhtml?persistentId=doi:10.18738/T8/S4WTWR), and you can try out our preference elicitation interface [here](https://dev.d31krhv9hakv9z.amplifyapp.com/)!

**Abstract**

The utility of reinforcement learning is limited by the alignment of reward functions with the interests of human stakeholders. One promising method for alignment is to learn the reward function from human-generated preferences between pairs of trajectory segments, a type of reinforcement learning from human feedback (RLHF). These human preferences are typically assumed to be informed solely by partial return, the sum of rewards along each segment. We find this assumption to be flawed and propose modeling human preferences instead as informed by each segment's regret, a measure of a segment's deviation from optimal decision-making. Given infinitely many preferences generated according to regret, we prove that we can identify a reward function equivalent to the reward function that generated those preferences, and we prove that the previous partial return model lacks this identifiability property in multiple contexts. We empirically show that our proposed regret preference model outperforms the partial return preference model with finite training data in otherwise the same setting. Additionally, we find that our proposed regret preference model better predicts real human preferences and also learns reward functions from these preferences that lead to policies that are better human-aligned. Overall, this work establishes that the choice of preference model is impactful, and our proposed regret preference model provides an improvement upon a core assumption of recent research. We have open sourced our experimental code, the human preferences dataset we gathered, and our training and preference elicitation interfaces for gathering a such a dataset.
