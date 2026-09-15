-- =============================================================================
-- LexiFlow Seed Data (MySQL 8.0+)
-- Database: lexiflow_db
-- =============================================================================

USE lexiflow_db;

-- 1. 默认用户 (密码为 123456，BCrypt 加密)
-- BCrypt for "123456" is $2a$10$7Z8Yq4.wI4uI/Mv4z3R1ge1W1fO4wT8c3x5C2k9l1b7V8m3n2a
INSERT INTO `sys_user` (`id`, `username`, `email`, `password`, `nickname`, `avatar`) 
VALUES (1, 'lin', 'lin@lexiflow.local', '$2a$10$EblZqNptyYvcLm/VwDCVAuBjzZOI7khzdyGPBr08PpIi0na624b8.', 'Lin Z.', '/avatars/user.jpg')
ON DUPLICATE KEY UPDATE `nickname` = VALUES(`nickname`);

-- 2. 内置词书
INSERT INTO `wordbook` (`id`, `title`, `description`, `category`, `cover_url`, `total_words`)
VALUES 
(1, 'CET-4 核心高频词汇', '历年全国大学英语四级真题中出现频次最高的 40 组核心骨干词汇', 'EXAM', '/covers/cet4.jpg', 35),
(2, 'CET-6 提分冲刺词汇', '六级听力声学语篇与高分长难句核心词汇', 'EXAM', '/covers/cet6.jpg', 30),
(3, '影视美剧日常口语 500 词', '原汁原味真实对白中的高频词与俚语短语', 'COLLOQUIAL', '/covers/daily.jpg', 25)
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 3. 核心词典库 (精选四六级与高频语流词汇)
INSERT INTO `dict_entry` (`id`, `lemma`, `phonetic_us`, `phonetic_uk`, `pos`, `definition_cn`, `definition_en`, `tags`, `frequency_rank`, `sample_sentence`, `sample_translation`)
VALUES
(1, 'flow', '/floʊ/', '/fləʊ/', 'n./v.', 'n. 心流；连贯流动；语流 v. 流畅移动', 'the smooth continuous movement of something', 'CET4,CET6', 1200, 'I was completely in the flow when shadowing the dialogue.', '我在做对话影子跟读时完全进入了心流状态。'),
(2, 'create', '/kriˈeɪt/', '/kriˈeɪt/', 'v.', 'v. 创造；构建；引发', 'to bring something into existence', 'CET4,CET6', 450, 'Language learners create meaningful connections through context.', '语言学习者通过语境建立有意义的认知联结。'),
(3, 'design', '/dɪˈzaɪn/', '/dɪˈzaɪn/', 'n./v.', 'n. 设计；架构构想 v. 构思；筹划', 'to plan or produce something for a specific purpose', 'CET4,CET6', 620, 'The cognitive system was designed for optimal memory retention.', '该认知系统的设计旨在实现最佳的记忆留存。'),
(4, 'system', '/ˈsɪstəm/', '/ˈsɪstəm/', 'n.', 'n. 体系；算法系统；机制', 'a set of connected things or parts forming a complex whole', 'CET4,CET6', 230, 'The FSRS scheduling system predicts forgetting curves accurately.', 'FSRS 复习调度系统能够精准预测遗忘曲线。'),
(5, 'productivity', '/ˌproʊdʌkˈtɪvəti/', '/ˌprɒdʌkˈtɪvəti/', 'n.', 'n. 生产力；研习效能；通量', 'the effectiveness of productive effort', 'CET4,CET6', 1850, 'Active recall significantly boosts daily study productivity.', '主动提取能够显著提升每日的研习效率。'),
(6, 'workspace', '/ˈwɜːrkspeɪs/', '/ˈwɜːkspeɪs/', 'n.', 'n. 工作区；沉浸式工作台', 'an area allocated for someone to work in', 'CET4', 3200, 'Welcome to your distraction-free acoustic language workspace.', '欢迎来到您的无干扰沉浸式语言研习工作台。'),
(7, 'data', '/ˈdeɪtə/', '/ˈdeɪtə/', 'n.', 'n. 数据；记忆指标追踪', 'facts and statistics collected together for reference', 'CET4,CET6', 180, 'Learning data provides clear visual feedback on memory half-life.', '研习数据为记忆遗忘半衰期提供了清晰的可视化反馈。'),
(8, 'build', '/bɪld/', '/bɪld/', 'v.', 'v. 构建；巩固；积累', 'construct something by putting parts or material together', 'CET4', 510, 'Consistency helps you build a solid lexical foundation.', '持之以恒能帮助你构建坚固的词汇基石。'),
(9, 'digital', '/ˈdɪdʒɪtl/', '/ˈdɪdʒɪtl/', 'adj.', 'adj. 数字化的；多模态的', 'involving or relating to computer technology', 'CET4', 1100, 'Digital flashcards are enhanced by video context snapshots.', '数字化抽认卡通过视频语境快照得到了极大增强。'),
(10, 'technology', '/tekˈnɑːlədʒi/', '/tekˈnɒlədʒi/', 'n.', 'n. 语音智能；声学技术', 'the application of scientific knowledge for practical purposes', 'CET4,CET6', 420, 'Acoustic alignment technology allows millisecond-level shadowing.', '声学对齐技术使得毫秒级影子跟读成为可能。'),
(11, 'innovation', '/ˌɪnəˈveɪʃn/', '/ˌɪnəˈveɪʃn/', 'n.', 'n. 创新；突破；革新', 'the action or process of innovating', 'CET4,CET6', 1400, 'Spaced repetition algorithms represent a major innovation in SLA.', '间隔重复算法代表了二语习得领域的重大创新。'),
(12, 'future', '/ˈfjuːtʃər/', '/ˈfjuːtʃə/', 'n./adj.', 'n. 未来；前景 adj. 未来的', 'a period of time following the moment of speaking', 'CET4', 380, 'The future of language acquisition is multimodal and contextual.', '下一代语言习得的未来是多模态且深嵌语境的。'),
(13, 'workflow', '/ˈwɜːrkfloʊ/', '/ˈwɜːkfləʊ/', 'n.', 'n. 工作流；研习链路', 'the sequence of industrial, administrative, or other processes', 'CET6', 2900, 'The four-step workflow guarantees deep memory consolidation.', '四步工作流保证了记忆的深度固化。'),
(14, 'cognition', '/kɑːɡˈnɪʃn/', '/kɒɡˈnɪʃn/', 'n.', 'n. 认知能力；心智感知', 'the mental action or process of acquiring knowledge and understanding', 'CET6,IELTS', 2600, 'Active retrieval strengthens the neural basis of cognition.', '主动检索强化了认知心智的神经生物学基础。'),
(15, 'shadowing', '/ˈʃædoʊɪŋ/', '/ˈʃædəʊɪŋ/', 'n.', 'n. 影子跟读；跟读复述训练', 'a language learning technique where you repeat speech immediately', 'IELTS,TOEFL', 4500, 'Shadowing authentic video clips dramatically improves speech cadence.', '对真实视频切片进行影子跟读能极大改善语流步频。'),
(16, 'retrieval', '/rɪˈtriːvl/', '/rɪˈtriːvl/', 'n.', 'n. 检索；主动提取；挽回', 'the process of getting something back from somewhere', 'CET6,IELTS', 3800, 'Testing yourself is a powerful form of active memory retrieval.', '自我测试是一种极其强效的主动记忆提取训练。'),
(17, 'resonance', '/ˈrezənəns/', '/ˈrezənəns/', 'n.', 'n. 声学共鸣；共振；情感共鸣', 'the quality in a sound of being deep, full, and reverberating', 'CET6,GRE', 4100, 'Vocal resonance can be monitored using waveform visualization.', '声音共鸣可以通过原声音频波形可视化来进行监测。'),
(18, 'ephemeral', '/ɪˈfemərəl/', '/ɪˈfemərəl/', 'adj.', 'adj. 短暂的；转瞬即逝的', 'lasting for a very short time', 'CET6,GRE', 8200, 'Sensory memory is ephemeral unless transferred to long-term storage.', '感觉记忆是转瞬即逝的，除非被转存至长时记忆系统。'),
(19, 'serendipity', '/ˌserənˈdɪpəti/', '/ˌserənˈdɪpɪti/', 'n.', 'n. 意外惊喜；机缘巧合的幸运发现', 'the occurrence of events by chance in a happy or beneficial way', 'CET6,GRE', 9100, 'Encountering familiar words in casual reading is pure serendipity.', '在随心泛读中偶遇之前背过的单词是纯粹的机缘惊喜。'),
(20, 'neuroplasticity', '/ˌnʊroʊplæˈstɪsəti/', '/ˌnjʊərəʊplæˈstɪsəti/', 'n.', 'n. 大脑神经可塑性', 'the ability of the brain to form and reorganize synaptic connections', 'TOEFL,GRE', 12000, 'Adult language learning leverages the brain innate neuroplasticity.', '成年人语言研习充分利用了大脑天生的神经可塑性。'),
(21, 'eloquent', '/ˈeləkwənt/', '/ˈeləkwənt/', 'adj.', 'adj. 雄辩的；表达生动有力的', 'fluent or persuasive in speaking or writing', 'CET6,GRE', 5400, 'She gave an eloquent argument for immersive language learning.', '她就沉浸式语言习得发表了一场富有感染力的雄辩演讲。'),
(22, 'prosody', '/ˈprɑːsədi/', '/ˈprɒsədi/', 'n.', 'n. 韵律学；语调步频；抑扬顿挫', 'the patterns of rhythm and sound used in speech', 'IELTS,GRE', 9800, 'Natural prosody distinguishes native speakers from robotic speech.', '自然地道的语流韵律是将母语者与机械发音区分开的关键。'),
(23, 'cadence', '/ˈkeɪdns/', '/ˈkeɪdns/', 'n.', 'n. 节奏；抑扬顿挫；语流节拍', 'a modulation or inflection of the voice', 'CET6,GRE', 6700, 'The measured cadence of the speaker captivated the whole audience.', '演讲者抑扬顿挫的从容节奏吸引了全场观众。'),
(24, 'nuance', '/ˈnuːɑːns/', '/ˈnjuːɑːns/', 'n.', 'n. 细微差别；语气微妙之处', 'a subtle difference in or shade of meaning, expression, or sound', 'CET6,IELTS', 3400, 'Context snapshots help you perceive subtle emotional nuances.', '语境快照有助于研习者捕捉微妙的情感语气细微差别。'),
(25, 'ubiquitous', '/juːˈbɪkwɪtəs/', '/juːˈbɪkwɪtəs/', 'adj.', 'adj. 无所不在的；普遍存在的', 'present, appearing, or found everywhere', 'CET6,GRE', 4800, 'English media is ubiquitous in our modern connected world.', '英语媒体在我们当今互联的世界中几乎无处不在。'),
(26, 'catalyst', '/ˈkætəlɪst/', '/ˈkætəlɪst/', 'n.', 'n. 催化剂；促成者', 'a person or thing that precipitates an event', 'CET6,IELTS', 3900, 'Consistent spaced reviews serve as a catalyst for fluency.', '坚持规律的间隔复习是促成语言流利表达的强效催化剂。'),
(27, 'lucid', '/ˈluːsɪd/', '/ˈluːsɪd/', 'adj.', 'adj. 清晰透彻的；明晰的', 'expressed clearly; easy to understand', 'CET6,GRE', 5600, 'He provided a lucid explanation of the acoustic model.', '他对声学大模型的架构提供了清晰透彻的讲解。'),
(28, 'zenith', '/ˈzenɪθ/', '/ˈzenɪθ/', 'n.', 'n. 顶峰；极盛时期', 'the time at which something is most powerful or successful', 'CET6,GRE', 7800, 'Her confidence reached its zenith after three months of study.', '经过三个月的集中研习，她的口语自信达到了顶峰。'),
(29, 'paradigm', '/ˈpærədaɪm/', '/ˈpærədaɪm/', 'n.', 'n. 范式；认知模型', 'a typical example or pattern of something; a model', 'CET6,IELTS', 3100, 'Connected speech requires a paradigm shift from rote memorization.', '连贯言语学习要求我们从死记硬背发生彻底的范式转变。'),
(30, 'synergy', '/ˈsɪnərdʒi/', '/ˈsɪnədʒi/', 'n.', 'n. 协同效应；增效作用', 'the interaction of elements that produces a combined greater effect', 'CET6,IELTS', 4200, 'The synergy between visual subtitles and acoustic audio speeds up recall.', '画面字幕与原声音频的协同效应极大加速了记忆回想。')
ON DUPLICATE KEY UPDATE `definition_cn` = VALUES(`definition_cn`);

-- 4. 词书与词条关联映射 (前 20 词归入 CET-4)
INSERT INTO `wordbook_item` (`wordbook_id`, `word_id`, `chapter_index`, `order_index`)
VALUES
(1, 1, 1, 1), (1, 2, 1, 2), (1, 3, 1, 3), (1, 4, 1, 4), (1, 5, 1, 5),
(1, 6, 1, 6), (1, 7, 1, 7), (1, 8, 1, 8), (1, 9, 1, 9), (1, 10, 1, 10),
(1, 11, 2, 1), (1, 12, 2, 2), (1, 13, 2, 3), (1, 14, 2, 4), (1, 15, 2, 5),
(1, 16, 2, 6), (1, 17, 2, 7), (1, 18, 2, 8), (1, 19, 2, 9), (1, 20, 2, 10)
ON DUPLICATE KEY UPDATE `chapter_index` = VALUES(`chapter_index`);

-- 5. 为默认用户 Lin 初始化前 15 张生词卡片（模拟不同 FSRS 状态与到期日）
INSERT INTO `user_word` (`id`, `user_id`, `word_id`, `lemma`, `source`, `wordbook_id`, `state`, `stability`, `difficulty`, `due_at`, `reps`, `lapses`, `is_known`)
VALUES
(1, 1, 1, 'flow', 'WORDBOOK', 1, 2, 4.8, 4.2, DATE_SUB(NOW(), INTERVAL 2 HOUR), 3, 0, 0), -- 今日已到期
(2, 1, 2, 'create', 'WORDBOOK', 1, 2, 3.2, 5.1, DATE_SUB(NOW(), INTERVAL 1 HOUR), 2, 0, 0), -- 今日已到期
(3, 1, 3, 'design', 'WORDBOOK', 1, 2, 6.5, 3.8, DATE_SUB(NOW(), INTERVAL 30 MINUTE), 4, 0, 0), -- 今日已到期
(4, 1, 4, 'system', 'WORDBOOK', 1, 1, 1.2, 6.0, DATE_SUB(NOW(), INTERVAL 10 MINUTE), 1, 0, 0), -- 今日初学到期
(5, 1, 5, 'productivity', 'WORDBOOK', 1, 2, 8.4, 4.5, DATE_SUB(NOW(), INTERVAL 5 MINUTE), 5, 0, 0), -- 今日已到期
(6, 1, 6, 'workspace', 'WORDBOOK', 1, 0, 0.0, 0.0, NOW(), 0, 0, 0), -- 全新未学词
(7, 1, 7, 'data', 'WORDBOOK', 1, 0, 0.0, 0.0, NOW(), 0, 0, 0), -- 全新未学词
(8, 1, 8, 'build', 'WORDBOOK', 1, 0, 0.0, 0.0, NOW(), 0, 0, 0), -- 全新未学词
(9, 1, 9, 'digital', 'WORDBOOK', 1, 2, 14.5, 3.2, DATE_ADD(NOW(), INTERVAL 3 DAY), 6, 0, 0), -- 未来待复习
(10, 1, 10, 'technology', 'WORDBOOK', 1, 2, 21.0, 2.9, DATE_ADD(NOW(), INTERVAL 7 DAY), 8, 0, 0), -- 未来待复习
(11, 1, 14, 'cognition', 'VIDEO', NULL, 3, 0.8, 7.5, DATE_SUB(NOW(), INTERVAL 15 MINUTE), 3, 1, 0), -- 重学到期
(12, 1, 15, 'shadowing', 'VIDEO', NULL, 2, 5.0, 4.0, DATE_SUB(NOW(), INTERVAL 3 HOUR), 2, 0, 0) -- 视频采词到期
ON DUPLICATE KEY UPDATE `due_at` = VALUES(`due_at`);

-- 6. 初始化最近 30 天每日研习打卡数据 (支撑 GitHub 风格热力图)
INSERT INTO `daily_stat` (`user_id`, `stat_date`, `new_cards`, `review_cards`, `total_reviews`, `duration_minutes`, `retention_rate`)
VALUES
(1, DATE_SUB(CURDATE(), INTERVAL 29 DAY), 10, 25, 35, 22, 0.88),
(1, DATE_SUB(CURDATE(), INTERVAL 28 DAY), 12, 30, 42, 28, 0.90),
(1, DATE_SUB(CURDATE(), INTERVAL 27 DAY), 8,  22, 30, 18, 0.85),
(1, DATE_SUB(CURDATE(), INTERVAL 25 DAY), 15, 35, 50, 32, 0.92),
(1, DATE_SUB(CURDATE(), INTERVAL 24 DAY), 10, 40, 50, 30, 0.89),
(1, DATE_SUB(CURDATE(), INTERVAL 23 DAY), 6,  28, 34, 20, 0.94),
(1, DATE_SUB(CURDATE(), INTERVAL 22 DAY), 14, 45, 59, 36, 0.91),
(1, DATE_SUB(CURDATE(), INTERVAL 20 DAY), 12, 38, 50, 31, 0.88),
(1, DATE_SUB(CURDATE(), INTERVAL 19 DAY), 18, 52, 70, 45, 0.93),
(1, DATE_SUB(CURDATE(), INTERVAL 18 DAY), 10, 33, 43, 26, 0.87),
(1, DATE_SUB(CURDATE(), INTERVAL 16 DAY), 8,  29, 37, 21, 0.89),
(1, DATE_SUB(CURDATE(), INTERVAL 15 DAY), 15, 48, 63, 40, 0.92),
(1, DATE_SUB(CURDATE(), INTERVAL 14 DAY), 20, 55, 75, 48, 0.95),
(1, DATE_SUB(CURDATE(), INTERVAL 13 DAY), 10, 36, 46, 28, 0.90),
(1, DATE_SUB(CURDATE(), INTERVAL 12 DAY), 12, 42, 54, 34, 0.91),
(1, DATE_SUB(CURDATE(), INTERVAL 11 DAY), 16, 50, 66, 42, 0.93),
(1, DATE_SUB(CURDATE(), INTERVAL 9 DAY),  8,  31, 39, 23, 0.87),
(1, DATE_SUB(CURDATE(), INTERVAL 8 DAY),  14, 46, 60, 38, 0.92),
(1, DATE_SUB(CURDATE(), INTERVAL 7 DAY),  22, 60, 82, 52, 0.96),
(1, DATE_SUB(CURDATE(), INTERVAL 6 DAY),  15, 45, 60, 36, 0.90),
(1, DATE_SUB(CURDATE(), INTERVAL 5 DAY),  18, 52, 70, 44, 0.93),
(1, DATE_SUB(CURDATE(), INTERVAL 4 DAY),  12, 38, 50, 30, 0.89),
(1, DATE_SUB(CURDATE(), INTERVAL 3 DAY),  16, 48, 64, 41, 0.92),
(1, DATE_SUB(CURDATE(), INTERVAL 2 DAY),  20, 58, 78, 49, 0.94),
(1, DATE_SUB(CURDATE(), INTERVAL 1 DAY),  24, 65, 89, 56, 0.95),
(1, CURDATE(),                            15, 42, 57, 35, 0.93)
ON DUPLICATE KEY UPDATE `total_reviews` = VALUES(`total_reviews`);
