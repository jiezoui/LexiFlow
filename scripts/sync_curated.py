# -*- coding: utf-8 -*-
import json
import pymysql

curated = {
    'practical': {
        'sentence': 'Let’s be practical and book the earlier train.',
        'translation': '咱们实际一点，订早一点的火车吧。',
        'spoken': [{'line': 'Is that really practical?', 'meaning': '那真的可行吗？'}, {'line': 'On a practical level, we need more time.', 'meaning': '从实际层面来说，我们需要更多时间。'}],
        'synonyms': ['realistic', 'useful', 'sensible'],
        'antonyms': ['impractical', 'unrealistic'],
        'derivatives': ['practice', 'practically', 'practicable']
    },
    'reliable': {
        'sentence': 'Maya is the most reliable person on our team.',
        'translation': 'Maya 是我们团队里最靠谱的人。',
        'spoken': [{'line': 'Can we rely on this data?', 'meaning': '这些数据可靠吗？'}, {'line': 'He’s always been reliable.', 'meaning': '他一直都很靠谱。'}],
        'synonyms': ['dependable', 'trustworthy', 'consistent'],
        'antonyms': ['unreliable', 'inconsistent'],
        'derivatives': ['reliably', 'reliability', 'reliant']
    },
    'figure': {
        'sentence': 'I figured you might need a hand.',
        'translation': '我想着你可能需要帮忙。',
        'spoken': [{'line': 'I figure we’ll be there by eight.', 'meaning': '我估计我们八点前能到。'}, {'line': 'We’ll figure something out.', 'meaning': '我们会想出办法的。'}],
        'synonyms': ['think', 'calculate', 'understand'],
        'antonyms': ['misjudge', 'overlook'],
        'derivatives': ['figurative', 'figuratively', 'figures']
    },
    'awkward': {
        'sentence': 'There was an awkward silence after his joke.',
        'translation': '他的笑话说完后，现场一阵尴尬的沉默。',
        'spoken': [{'line': 'Well, this is awkward.', 'meaning': '呃，这就有点尴尬了。'}, {'line': 'Is now an awkward time?', 'meaning': '现在是不是不太方便？'}],
        'synonyms': ['uncomfortable', 'clumsy', 'tricky'],
        'antonyms': ['comfortable', 'graceful'],
        'derivatives': ['awkwardly', 'awkwardness']
    },
    'handle': {
        'sentence': 'Don’t worry—I can handle it.',
        'translation': '别担心，我能处理。',
        'spoken': [{'line': 'I can handle it from here.', 'meaning': '接下来我能搞定。'}, {'line': 'How are you handling the pressure?', 'meaning': '你是怎么应对压力的？'}],
        'synonyms': ['manage', 'deal with', 'cope with'],
        'antonyms': ['mismanage', 'neglect'],
        'derivatives': ['handler', 'handling', 'handful']
    },
    'approach': {
        'sentence': 'We need a different approach to this problem.',
        'translation': '我们需要用不同的方法处理这个问题。',
        'spoken': [{'line': 'Let’s approach it another way.', 'meaning': '我们换个方式处理吧。'}, {'line': 'I like your approach.', 'meaning': '我喜欢你的处理方式。'}],
        'synonyms': ['method', 'strategy', 'come near'],
        'antonyms': ['avoid', 'withdraw'],
        'derivatives': ['approachable', 'approaching']
    },
    'significant': {
        'sentence': 'We’ve made significant progress this month.',
        'translation': '这个月我们取得了显著进展。',
        'spoken': [{'line': 'That’s a significant difference.', 'meaning': '那是个很明显的差别。'}, {'line': 'It had a significant impact on me.', 'meaning': '它对我产生了很大的影响。'}],
        'synonyms': ['considerable', 'important', 'meaningful'],
        'antonyms': ['minor', 'insignificant'],
        'derivatives': ['significance', 'significantly']
    },
    'perspective': {
        'sentence': 'Try to see it from her perspective.',
        'translation': '试着从她的角度看这件事。',
        'spoken': [{'line': 'That’s one way to look at it.', 'meaning': '那也是一种看法。'}, {'line': 'Let me give you my perspective.', 'meaning': '我来说说我的看法。'}],
        'synonyms': ['viewpoint', 'outlook', 'angle'],
        'antonyms': ['blindness', 'misconception'],
        'derivatives': ['perspectives']
    },
    'clarify': {
        'sentence': 'Could you clarify what you mean by flexible?',
        'translation': '你能说明一下你说的“灵活”是什么意思吗？',
        'spoken': [{'line': 'Just to clarify, are we meeting at six?', 'meaning': '确认一下，我们是六点见吗？'}, {'line': 'Could you clarify that last point?', 'meaning': '你能说明一下最后那一点吗？'}],
        'synonyms': ['explain', 'make clear', 'specify'],
        'antonyms': ['confuse', 'obscure'],
        'derivatives': ['clarity', 'clarification']
    },
    'flexible': {
        'sentence': 'I’m flexible, so any time after six works for me.',
        'translation': '我时间比较灵活，六点以后都可以。',
        'spoken': [{'line': 'My schedule is pretty flexible.', 'meaning': '我的时间安排很灵活。'}, {'line': 'We can be flexible about the date.', 'meaning': '日期方面我们可以变通。'}],
        'synonyms': ['adaptable', 'adjustable', 'open-minded'],
        'antonyms': ['rigid', 'inflexible'],
        'derivatives': ['flexibility', 'flexibly']
    },
    'sustainable': {
        'sentence': 'Working twelve hours a day isn’t sustainable.',
        'translation': '每天工作十二小时是无法长期维持的。',
        'spoken': [{'line': 'This pace just isn’t sustainable.', 'meaning': '这个节奏实在无法长期维持。'}, {'line': 'We need a more sustainable plan.', 'meaning': '我们需要一个更能长久执行的计划。'}],
        'synonyms': ['viable', 'maintainable', 'eco-friendly'],
        'antonyms': ['unsustainable', 'short-lived'],
        'derivatives': ['sustain', 'sustainability']
    },
    'relevant': {
        'sentence': 'That’s interesting, but is it relevant to the question?',
        'translation': '那很有意思，但和这个问题有关吗？',
        'spoken': [{'line': 'How is that relevant?', 'meaning': '那有什么关系？'}, {'line': 'I have some relevant experience.', 'meaning': '我有一些相关经验。'}],
        'synonyms': ['related', 'applicable', 'pertinent'],
        'antonyms': ['irrelevant', 'unrelated'],
        'derivatives': ['relevance', 'relatively']
    }
}

conn = pymysql.connect(host='127.0.0.1', port=3306, user='root', password='root', database='lexiflow_db', charset='utf8mb4')
with conn.cursor() as cursor:
    for word, info in curated.items():
        cursor.execute('''
            UPDATE dict_entry
            SET sample_sentence = %s,
                sample_translation = %s,
                spoken_examples = %s,
                synonyms = %s,
                antonyms = %s,
                derivatives = %s
            WHERE lemma = %s
        ''', (
            info['sentence'],
            info['translation'],
            json.dumps(info['spoken'], ensure_ascii=False),
            json.dumps(info['synonyms'], ensure_ascii=False),
            json.dumps(info['antonyms'], ensure_ascii=False),
            json.dumps(info['derivatives'], ensure_ascii=False),
            word
        ))
    cursor.execute('''
        UPDATE user_word uw
        JOIN dict_entry de ON uw.word_id = de.id
        SET uw.context_sentence = de.sample_sentence,
            uw.context_translation = de.sample_translation
    ''')
    conn.commit()
conn.close()
print("Curated words successfully synchronized into dict_entry and user_word!")
