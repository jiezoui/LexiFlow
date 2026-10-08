"""Validate production CTC state marginals against exhaustive token-path enumeration.

Tiny artificial emission matrices validate mathematics only, never pronunciation
accuracy. The oracle collapses raw token paths independently of the production DP.
"""
import itertools
import sys
from types import SimpleNamespace
from unittest.mock import patch
import numpy as np
from benchmark_common import ROOT, OUT, sha256, write_json
sys.path.insert(0, str(ROOT/'speech-bridge'))
from speech_bridge import assess


def oracle(p, reference):
    T, V = p.shape
    gamma = np.zeros((T, 2*len(reference)+1))
    total = 0.
    count = 0
    for path in itertools.product(range(V), repeat=T):
        collapsed = []
        states = []
        for t, token in enumerate(path):
            if token != 0 and (t == 0 or token != path[t-1]):
                collapsed.append(token)
            states.append(2*len(collapsed) if token == 0 else 2*len(collapsed)-1)
        if collapsed != reference:
            continue
        mass = np.prod(p[np.arange(T), path])
        total += mass
        count += 1
        gamma[np.arange(T), states] += mass
    return gamma / total, float(np.log(total)), count


def production(p, reference):
    captured = {}
    def trace(frame, event, arg):
        if frame.f_code is assess.ctc_forced_align.__code__ and event == 'return':
            for key in ('gamma', 'total'):
                if key in frame.f_locals:
                    captured[key] = np.array(frame.f_locals[key], copy=True)
        return trace
    previous = sys.gettrace()
    try:
        with patch.object(assess, 'load_phoneme_model', return_value=(None, SimpleNamespace(config=SimpleNamespace(pad_token_id=0)))), patch.object(assess, '_log_probs', return_value=np.log(p)):
            sys.settrace(trace)
            assess.ctc_forced_align(np.zeros(3200), [(str(i), i) for i in reference])
    finally:
        sys.settrace(previous)
    return np.exp(captured['gamma']), float(captured['total'])


def main():
    rng = np.random.default_rng(20261005)
    cases = []
    for labels in ([1], [1,2], [1,1], [1,2,1]):
        for T in (5,6):
            for mode in range(6):
                p = rng.dirichlet([8,1,1] if mode < 3 else [1,1,1], size=T)
                expected, logz, paths = oracle(p, list(labels))
                actual, actual_logz = production(p, list(labels))
                error = float(np.max(np.abs(expected-actual)))
                cases.append({'labels':labels,'frames':T,'blank_dominant':mode<3,'legal_paths':paths,
                              'max_posterior_error':error,'log_partition_error':abs(actual_logz-logz),
                              'normalization_error':float(np.max(np.abs(actual.sum(axis=1)-1)))})
    long_p = np.tile([.01,.01,.98], (500,1))
    _, long_logz = production(long_p, [1])
    expected_long_logz = np.log(500*501/2) + 500*np.log(.01)
    unreachable = assess._logaddexp(np.array([-np.inf]), np.array([-np.inf]))
    stability = {'frames':500,'linear_single_path_mass':float(.01**500),
                 'log_partition':long_logz,'closed_form_log_partition':float(expected_long_logz),
                 'absolute_error':float(abs(long_logz-expected_long_logz)),
                 'negative_infinity_safe':bool(np.isneginf(unreachable[0]))}
    result={'kind':'exhaustive numerical oracle, synthetic emissions; not speech accuracy',
            'source_sha256':sha256(ROOT/'speech-bridge/speech_bridge/assess.py'),
            'cases':cases,'case_count':len(cases),
            'max_posterior_error':max(c['max_posterior_error'] for c in cases),
            'max_log_partition_error':max(c['log_partition_error'] for c in cases),
            'long_sequence_stability':stability,
            'passed':all(c['max_posterior_error']<1e-10 and c['log_partition_error']<1e-10 for c in cases)
              and stability['absolute_error']<1e-9 and stability['negative_infinity_safe']}
    write_json(OUT/'ctc_numerical_verification.json',result)
    print({k:v for k,v in result.items() if k!='cases'})
    return 0 if result['passed'] else 1

if __name__=='__main__':sys.exit(main())
