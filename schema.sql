-- Questions and options (editable from admin)
CREATE TABLE IF NOT EXISTS questions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  category   TEXT NOT NULL,
  scenario   TEXT NOT NULL,
  question   TEXT NOT NULL,
  order_num  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS question_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  text        TEXT NOT NULL,
  weight      INTEGER NOT NULL,
  FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Responses (answers_json replaces fixed q1-q20 columns)
DROP TABLE IF EXISTS responses;
CREATE TABLE responses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  answers_json    TEXT NOT NULL,
  total_score     INTEGER NOT NULL,
  score_pct       REAL NOT NULL,
  readiness_level TEXT NOT NULL,
  submitted_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed questions (INSERT OR IGNORE = safe to re-run)
INSERT OR IGNORE INTO questions (id, category, scenario, question, order_num) VALUES
(1,  'Crisis Management',             'Your team discovers a critical security breach that has exposed customer data. The breach happened 2 hours ago, and customers are starting to notice unusual activity.',                                                                                                                'What is your immediate course of action?',          1),
(2,  'Team Leadership',               'Two of your senior team members have a fundamental disagreement about the technical approach for a high-stakes project. The conflict is affecting team morale and the project deadline is in 3 weeks.',                                                                          'How do you handle this situation?',                 2),
(3,  'Strategic Planning',            'Your company is considering adopting a new technology that could provide competitive advantage, but it requires significant investment and retraining of 60% of your team. Early adopters in the industry have had mixed results.',                                               'What approach do you recommend?',                   3),
(4,  'Resource Management',           'You have a fixed budget and must choose between: hiring two junior developers to increase team capacity, or investing in training and tools for your existing team to improve efficiency.',                                                                                      'How do you allocate the budget?',                   4),
(5,  'Stakeholder Communication',     'A major project you''re leading is going to miss its deadline by 3 weeks due to unexpected technical challenges. The client has already communicated this deadline to their stakeholders.',                                                                                     'How do you communicate this to the client?',        5),
(6,  'Performance Management',        'A team member has been consistently missing deadlines and the quality of their work has declined over the past month. They were previously a strong performer.',                                                                                                               'What is your first step?',                          6),
(7,  'Conflict Resolution',           'During a team meeting, two colleagues have a heated argument about project priorities. The tension is affecting the entire team''s ability to focus and collaborate.',                                                                                                         'How do you handle this situation in the moment?',   7),
(8,  'Change Management',             'Your organization is implementing a major process change that will significantly alter how your team works. Several team members are resistant and expressing concerns about increased workload.',                                                                               'What is your approach to leading this change?',     8),
(9,  'Decision Making',               'You need to choose between two vendor proposals for a critical system. One is cheaper but from an unknown vendor; the other is 40% more expensive but from a proven partner. You have incomplete information about both.',                                                      'How do you proceed with this decision?',            9),
(10, 'Innovation',                    'A junior team member proposes an unconventional solution to a persistent problem. It''s creative but untested, and implementing it would require significant time and resources with uncertain outcomes.',                                                                      'How do you respond?',                               10),
(11, 'Customer Relations',            'A long-term client is threatening to cancel their contract due to a service issue. The issue was caused by a limitation in your product that cannot be quickly resolved. They want an immediate solution or they will switch to a competitor.',                                 'What is your response strategy?',                   11),
(12, 'Ethical Dilemma',               'You discover that a colleague has been inflating their performance metrics in reports to management. This has resulted in them receiving recognition and potentially affecting team resource allocation.',                                                                       'What do you do?',                                   12),
(13, 'Time Management',               'You have three urgent tasks all due today: a critical bug fix, a presentation for executives, and a client deliverable. You can only complete two of them on time.',                                                                                                           'How do you prioritize?',                            13),
(14, 'Quality vs Speed',              'Your team is behind schedule on a project. To meet the deadline, you could skip some testing and documentation, or you could maintain quality standards and request a deadline extension.',                                                                                    'What do you decide?',                               14),
(15, 'Delegation & Trust',            'A critical project component needs to be completed, and a capable team member has asked to lead it. However, you are concerned about the high stakes and are tempted to do it yourself to ensure it is done right.',                                                           'What do you do?',                                   15),
(16, 'Learning & Development',        'You realize your technical skills in an emerging area are becoming outdated, and this is affecting your ability to contribute to strategic discussions. You have limited time due to current work commitments.',                                                                'How do you address this skills gap?',               16),
(17, 'Feedback & Communication',      'You receive critical feedback from your manager about your leadership style. The feedback is difficult to hear and you partially disagree with their assessment.',                                                                                                             'How do you respond?',                               17),
(18, 'Cross-Functional Collaboration','A project requires close collaboration with another department that has different priorities and timelines. Initial meetings have been unproductive, with both teams talking past each other.',                                                                                 'What is your strategy to move forward?',            18),
(19, 'Risk Management',               'During project planning, you identify a significant technical risk that could derail the project. Acknowledging it may make stakeholders lose confidence, but not addressing it could lead to failure later.',                                                                 'How do you handle this risk?',                      19),
(20, 'Organizational Politics',       'You are aware of an organizational change that will significantly impact your team, but you have been asked by leadership to keep it confidential until the official announcement next month. Your team is making decisions based on outdated assumptions.',                   'What do you do?',                                   20);

-- Seed options ordered by weight ASC per question
INSERT OR IGNORE INTO question_options (id, question_id, text, weight) VALUES
-- Q1 Crisis Management
(1,  1, 'Wait to gather all facts before taking any action to avoid spreading misinformation', 1),
(2,  1, 'Shut down all systems immediately to prevent further damage, then investigate', 2),
(3,  1, 'Immediately notify all affected customers via email and social media, then begin investigation', 3),
(4,  1, 'Contact legal and PR teams first, then follow their guidance on next steps', 4),
(5,  1, 'Assemble incident response team, contain the breach, assess impact, then communicate with stakeholders following protocol', 5),
-- Q2 Team Leadership
(6,  2, 'Let them work it out themselves since they''re senior team members', 1),
(7,  2, 'Make an executive decision on which approach to use and direct the team to follow it', 2),
(8,  2, 'Compromise by combining elements from both approaches', 3),
(9,  2, 'Escalate to your manager or bring in an external technical expert to decide', 4),
(10, 2, 'Facilitate a structured discussion where both members present their approaches with pros/cons, then make a decision based on project goals', 5),
-- Q3 Strategic Planning
(11, 3, 'Reject the technology and double down on current proven methods', 1),
(12, 3, 'Fully commit to the new technology immediately to stay ahead of competitors', 2),
(13, 3, 'Wait until the technology matures and more companies prove its value', 3),
(14, 3, 'Survey the team to gauge interest and make a decision based on team enthusiasm', 4),
(15, 3, 'Conduct a pilot program with a small team, measure results against KPIs, then make a data-driven decision to scale or pivot', 5),
-- Q4 Resource Management
(16, 4, 'Save the budget for now until a critical need emerges', 1),
(17, 4, 'Split the budget 50/50 between both options', 2),
(18, 4, 'Hire the junior developers to increase team size and output', 3),
(19, 4, 'Invest in training and tools for existing team to boost productivity', 4),
(20, 4, 'Analyze current bottlenecks, team skill gaps, and project pipeline, then allocate based on data and long-term strategy', 5),
-- Q5 Stakeholder Communication
(21, 5, 'Work extra hours to try to meet the deadline before telling the client anything', 1),
(22, 5, 'Send an email explaining the delay and apologizing for the inconvenience', 2),
(23, 5, 'Tell the client immediately via message with a new deadline, without detailed explanation', 3),
(24, 5, 'Have your manager communicate the delay to the client instead', 4),
(25, 5, 'Schedule a call to explain the situation, present a revised timeline with milestones, offer interim deliverables, and discuss mitigation strategies', 5),
-- Q6 Performance Management
(26, 6, 'Ignore it for now and see if the situation improves on its own', 1),
(27, 6, 'Reassign their critical tasks to other team members to ensure project success', 2),
(28, 6, 'Document the performance issues and schedule a formal performance improvement plan meeting', 3),
(29, 6, 'Send them an email outlining your concerns and asking for improvement', 4),
(30, 6, 'Have a private, supportive conversation to understand what''s changed and identify any obstacles or personal challenges', 5),
-- Q7 Conflict Resolution
(31, 7, 'Let them finish the discussion, then move on to the next agenda item', 1),
(32, 7, 'Ask both parties to present their cases to the team and vote on the best approach', 2),
(33, 7, 'Decide on the priority yourself and tell both parties to follow your decision', 3),
(34, 7, 'Acknowledge the disagreement, propose a follow-up discussion with relevant stakeholders, and redirect the meeting to other topics', 4),
(35, 7, 'Immediately call a break, then meet with both parties separately to understand their perspectives before reconvening', 5),
-- Q8 Change Management
(36, 8, 'Implement the change as directed and expect the team to adapt over time', 1),
(37, 8, 'Advocate to leadership that the change should be delayed until the team is more receptive', 2),
(38, 8, 'Hold a town hall meeting to address concerns and provide training resources', 3),
(39, 8, 'Implement the change in phases, starting with willing team members as champions', 4),
(40, 8, 'Hold a series of workshops to explain the rationale, demonstrate benefits, involve team in implementation planning, and establish feedback mechanisms', 5),
-- Q9 Decision Making
(41, 9, 'Choose the cheaper option to save budget and deal with issues if they arise', 1),
(42, 9, 'Ask your team to vote on which vendor they prefer', 2),
(43, 9, 'Go with the proven partner to minimize risk, regardless of cost', 3),
(44, 9, 'Negotiate with both vendors for better terms before deciding', 4),
(45, 9, 'Conduct a structured evaluation: request references, proof of concepts, detailed risk analysis, and calculate total cost of ownership before deciding', 5),
-- Q10 Innovation
(46, 10, 'Reject the idea and stick with proven approaches to avoid risk', 1),
(47, 10, 'Immediately greenlight the idea to encourage innovation and team morale', 2),
(48, 10, 'Suggest they implement it as a side project without affecting main work', 3),
(49, 10, 'Allocate a small budget for them to prototype and validate core assumptions first', 4),
(50, 10, 'Ask them to develop a detailed proposal with proof of concept, success metrics, and risk mitigation plan, then evaluate against current approach', 5),
-- Q11 Customer Relations
(51, 11, 'Promise to fix the issue immediately even though you know it cannot be done quickly', 1),
(52, 11, 'Accept that they will leave and focus on other clients', 2),
(53, 11, 'Offer them a significant discount to compensate for the inconvenience', 3),
(54, 11, 'Escalate to senior leadership to handle the negotiation', 4),
(55, 11, 'Schedule an urgent meeting to acknowledge the issue, explain honestly what can and cannot be done, offer interim workarounds, discuss long-term roadmap, and negotiate fair terms', 5),
-- Q12 Ethical Dilemma
(56, 12, 'Ignore it as it is not your responsibility to monitor others', 1),
(57, 12, 'Mention it casually to your manager and let them decide what to do', 2),
(58, 12, 'Immediately report the colleague to HR and their manager', 3),
(59, 12, 'Anonymously report the discrepancies through the company''s ethics hotline', 4),
(60, 12, 'Speak privately with the colleague first to understand the situation and encourage them to correct it, then escalate to management if needed', 5),
-- Q13 Time Management
(61, 13, 'Work on whichever task you feel most confident completing', 1),
(62, 13, 'Try to complete all three by working late into the night', 2),
(63, 13, 'Focus on the client deliverable since external commitments take priority', 3),
(64, 13, 'Partially complete all three and request extensions for final deliverables', 4),
(65, 13, 'Assess impact and urgency of each, communicate with stakeholders about constraints, negotiate deadlines or delegate where possible, then focus on highest business value', 5),
-- Q14 Quality vs Speed
(66, 14, 'Skip testing and documentation to meet the deadline', 1),
(67, 14, 'Reduce project scope to deliver a quality product on time', 2),
(68, 14, 'Request deadline extension to maintain full quality standards', 3),
(69, 14, 'Meet the deadline but plan to address quality gaps in a follow-up release', 4),
(70, 14, 'Evaluate the risks and business impact with stakeholders, propose minimum viable quality standards, and negotiate realistic timeline based on priorities', 5),
-- Q15 Delegation & Trust
(71, 15, 'Do it yourself to guarantee quality and meet expectations', 1),
(72, 15, 'Give them the task but review and approve every decision they make', 2),
(73, 15, 'Split the task and do the most critical parts yourself', 3),
(74, 15, 'Delegate but assign someone to shadow and learn from them', 4),
(75, 15, 'Delegate the task with clear expectations, success criteria, and checkpoints, while making yourself available for guidance', 5),
-- Q16 Learning & Development
(76, 16, 'Continue focusing on your current work and rely on team members for that expertise', 1),
(77, 16, 'Watch online tutorials in your spare time when you can', 2),
(78, 16, 'Attend a weekend workshop or boot camp to get up to speed quickly', 3),
(79, 16, 'Request to be assigned to a project that would force you to learn these skills', 4),
(80, 16, 'Create a learning plan with specific goals, schedule dedicated time for study, apply new skills to current projects, and seek mentorship or training resources', 5),
-- Q17 Feedback & Communication
(81, 17, 'Defend your approach and explain why their assessment is incorrect', 1),
(82, 17, 'Accept the feedback politely but do not change your behavior', 2),
(83, 17, 'Thank them for the feedback and think about it privately', 3),
(84, 17, 'Ask for specific examples and seek feedback from others to validate the assessment', 4),
(85, 17, 'Listen fully without interrupting, ask clarifying questions to understand specific examples, reflect on the feedback, and develop an action plan while requesting ongoing dialogue', 5),
-- Q18 Cross-Functional Collaboration
(86, 18, 'Work around the other department and complete what you can independently', 1),
(87, 18, 'Escalate to senior leadership to mandate the other department''s cooperation', 2),
(88, 18, 'Have informal coffee meetings with their team lead to build rapport', 3),
(89, 18, 'Propose a clear division of responsibilities and handoff points', 4),
(90, 18, 'Schedule an alignment workshop to establish shared goals, understand each team''s constraints, create joint success metrics, and build a collaborative working rhythm', 5),
-- Q19 Risk Management
(91, 19, 'Do not mention it now and hope you can solve it as you go', 1),
(92, 19, 'Mention the risk briefly but downplay its significance', 2),
(93, 19, 'Work on solving the risk before bringing it to stakeholders'' attention', 3),
(94, 19, 'Present the risk and ask stakeholders whether to proceed or cancel the project', 4),
(95, 19, 'Present the risk transparently with probability and impact assessment, propose mitigation strategies, include contingency plans, and adjust timeline/budget accordingly', 5),
-- Q20 Organizational Politics
(96,  20, 'Say nothing and let the team make decisions that will need to be reversed', 1),
(97,  20, 'Tell your team about the change despite the confidentiality request', 2),
(98,  20, 'Give vague hints to prepare the team without revealing specifics', 3),
(99,  20, 'Ask leadership for permission to share limited information with your team', 4),
(100, 20, 'Respect confidentiality while gently steering team away from decisions that will be problematic, and advocate with leadership for earlier communication', 5);
