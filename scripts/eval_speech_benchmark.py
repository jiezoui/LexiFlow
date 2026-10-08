"""Real audio + corpus-provided human ratings; never synthesize expert scores.

Protocol: 100 official-train utterances calibrate thresholds; 500 official-test
utterances evaluate three frozen methods. Reference ARPABET annotations are mapped
to model IPA tokens, isolating acoustic assessment from G2P. This is a component
benchmark, not a measurement of the complete app or specific phone-substitution
identification. Group F1 detects low human-rated phones within five target groups.
"""
from __future__ import annotations
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from unittest.mock import patch

os.environ['HF_HUB_OFFLINE']='1'
os.environ['TRANSFORMERS_OFFLINE']='1'
import numpy as np
import soundfile as sf
from scipy.stats import pearsonr, spearmanr
from benchmark_common import ROOT, OUT, COLORS, plt, save_figure, sha256, write_json
sys.path.insert(0,str(ROOT/'speech-bridge'))
from speech_bridge import assess, config

DATA=ROOT/'.deploy-cache/benchmarks/speechocean762'
METHODS=['ASR edit distance','Viterbi CTC','LexiFlow FB+Rank']
GROUPS=['/θ/–/s/','/r/–/l/','/v/–/w/','/iː/–/ɪ/','/ə/']
IPA={'AA':'ɑː','AE':'æ','AH':'ʌ','AO':'ɔː','AW':'aʊ','AY':'aɪ','B':'b',
     'CH':'tʃ','D':'d','DH':'ð','EH':'ɛ','ER':'ɚ','EY':'eɪ','F':'f','G':'ɡ',
     'HH':'h','IH':'ɪ','IY':'iː','JH':'dʒ','K':'k','L':'l','M':'m','N':'n',
     'NG':'ŋ','OW':'oʊ','OY':'ɔɪ','P':'p','R':'ɹ','S':'s','SH':'ʃ','T':'t',
     'TH':'θ','UH':'ʊ','UW':'uː','V':'v','W':'w','Y':'j','Z':'z','ZH':'ʒ'}

def tokens(text):return re.findall(r"[A-Z]+(?:'[A-Z]+)?",text.upper())

def word_alignment(reference,hypothesis):
    n,m=len(reference),len(hypothesis); dp=np.zeros((n+1,m+1),dtype=int)
    dp[:,0]=np.arange(n+1);dp[0,:]=np.arange(m+1)
    for i in range(1,n+1):
        for j in range(1,m+1):
            dp[i,j]=min(dp[i-1,j]+1,dp[i,j-1]+1,dp[i-1,j-1]+(reference[i-1]!=hypothesis[j-1]))
    scores=np.zeros(n);i,j=n,m
    while i or j:
        if i and j and dp[i,j]==dp[i-1,j-1]+(reference[i-1]!=hypothesis[j-1]):
            scores[i-1]=100. if reference[i-1]==hypothesis[j-1] else 0.;i-=1;j-=1
        elif i and dp[i,j]==dp[i-1,j]+1:i-=1
        else:j-=1
    return max(0.,100*(1-float(dp[n,m])/max(n,m,1))),scores

def viterbi_scores(logp,ids,blank):
    T,V=logp.shape; L=2*len(ids)+1
    labels=np.full(L,blank,dtype=int);labels[1::2]=ids
    allow=np.zeros(L,dtype=bool)
    allow[2:]=(labels[2:]!=blank)&(labels[2:]!=labels[:-2])
    dp=np.full((T,L),-np.inf);back=np.zeros((T,L),dtype=np.int8)
    dp[0,0]=logp[0,blank];dp[0,1]=logp[0,ids[0]]
    for t in range(1,T):
        choices=np.full((3,L),-np.inf);choices[0]=dp[t-1]
        choices[1,1:]=dp[t-1,:-1]
        choices[2,2:]=np.where(allow[2:],dp[t-1,:-2],-np.inf)
        back[t]=choices.argmax(axis=0)
        dp[t]=choices.max(axis=0)+logp[t,labels]
    s=L-1 if dp[-1,L-1]>=dp[-1,L-2] else L-2
    if not np.isfinite(dp[-1,s]):raise ValueError('No legal Viterbi path')
    states=np.empty(T,dtype=int)
    for t in range(T-1,-1,-1):states[t]=s;s-=int(back[t,s])
    result=[]
    for k,idx in enumerate(ids):
        frames=np.flatnonzero(states==2*k+1)
        result.append(assess.gop_to_score(float(np.exp(logp[frames,idx].mean()))) if len(frames) else 0.)
    return result

def group(phone):
    base=re.sub(r'\d','',phone)
    if base in ('TH','S'):return GROUPS[0]
    if base in ('R','L'):return GROUPS[1]
    if base in ('V','W'):return GROUPS[2]
    if base in ('IY','IH'):return GROUPS[3]
    if phone=='AH0':return GROUPS[4]
    return None

def infer(item,asr,processor,blank):
    started=time.perf_counter();audio,sr=sf.read(DATA/item['audio'],dtype='float32')
    if sr!=16000 or audio.ndim!=1:raise ValueError('Expected 16 kHz mono corpus audio')
    ann=item['annotation'];vocab=processor.tokenizer.get_vocab();phones=[];reference=[]
    for wi,word in enumerate(ann['words']):
        pseq=word['phones'].split() if isinstance(word['phones'],str) else word['phones']
        assert len(pseq)==len(word['phones-accuracy'])
        for ph,human in zip(pseq,word['phones-accuracy']):
            ipa='ə' if ph=='AH0' else IPA[re.sub(r'\d','',ph)]
            if ipa not in vocab:raise ValueError(f'Unknown model phone {ipa}')
            reference.append((ipa,vocab[ipa]))
            phones.append({'phone':ph,'ipa':ipa,'word_index':wi,'group':group(ph),'human':float(human)})
    t0=time.perf_counter()
    segments,_=asr.transcribe(audio,language='en',beam_size=5,temperature=0,
                              condition_on_previous_text=False,vad_filter=False)
    hypothesis=' '.join(s.text.strip() for s in segments)
    asr_ms=(time.perf_counter()-t0)*1000
    refwords=[w['text'].upper() for w in ann['words']]
    asr_score,word_scores=word_alignment(refwords,tokens(hypothesis))
    t0=time.perf_counter();logp=assess._log_probs(audio);model_ms=(time.perf_counter()-t0)*1000
    t0=time.perf_counter();vit=viterbi_scores(logp,[p[1] for p in reference],blank)
    vit_ms=(time.perf_counter()-t0)*1000
    t0=time.perf_counter()
    with patch.object(assess,'_log_probs',return_value=logp):
        aligned=assess.ctc_forced_align(audio,reference)
    fb_ms=(time.perf_counter()-t0)*1000
    fusion=[];posterior_only=[]
    for pos,ph in enumerate(phones):
        entry=aligned.get(pos)
        if entry:
            _,lo,hi,posterior,rank=entry
            score=assess.phoneme_score(posterior,rank)
            posterior_only.append(assess.gop_to_score(posterior))
            ph.update({'start_frame':lo,'end_frame':hi,'posterior':posterior,'rank':rank})
        else:score=0.;posterior_only.append(0.)
        fusion.append(score)
        ph['scores']=[float(word_scores[ph['word_index']]),float(vit[pos]),float(score)]
    return {'id':item['id'],'split':item['split'],'speaker':item['speaker'],
            'reference':ann['text'],'hypothesis':hypothesis,'duration_s':len(audio)/sr,
            'human_accuracy':10.*ann['accuracy'],
            'scores':[asr_score,float(np.mean(vit)),float(np.mean(fusion))],
            'fb_posterior_only':float(np.mean(posterior_only)),
            'phones':phones,'audio_sha256':item['sha256'],
            'timing_ms':{'asr':asr_ms,'acoustic_model':model_ms,'viterbi':vit_ms,'forward_backward':fb_ms,
                         'total':(time.perf_counter()-started)*1000}}

def binary_stats(truth,pred):
    truth=np.asarray(truth,dtype=bool);pred=np.asarray(pred,dtype=bool)
    tp=int(np.sum(truth&pred));fp=int(np.sum(~truth&pred));fn=int(np.sum(truth&~pred))
    return {'n':len(truth),'positive':int(truth.sum()),'tp':tp,'fp':fp,'fn':fn,
            'f1':2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0.}

def metrics(x,y):
    x=np.asarray(x,dtype=float);y=np.asarray(y,dtype=float)
    return {'pearson_r':float(pearsonr(x,y).statistic),'spearman_rho':float(spearmanr(x,y).statistic),
            'mae':float(np.mean(np.abs(x-y)))}

def summarize(rows,manifest,signature):
    dev=[r for r in rows if r['split']=='dev'];test=[r for r in rows if r['split']=='test']
    devphones=[p for r in dev for p in r['phones']]
    testphones=[p for r in test for p in r['phones']]
    methods=[]
    for k,name in enumerate(METHODS):
        grid=[]
        for threshold in range(0,102,2):
            st=binary_stats([p['human']<1 for p in devphones],[p['scores'][k]<threshold for p in devphones])
            grid.append((st['f1'],-abs(threshold-60),threshold))
        threshold=max(grid)[2]
        categories={}
        for g in GROUPS:
            part=[p for p in testphones if p['group']==g]
            categories[g]=binary_stats([p['human']<1 for p in part],[p['scores'][k]<threshold for p in part])
        methods.append({'method':name,'error_threshold':threshold,
            **metrics([r['scores'][k] for r in test],[r['human_accuracy'] for r in test]),
            'category_f1':categories,
            'all_phones':binary_stats([p['human']<1 for p in testphones],[p['scores'][k]<threshold for p in testphones])})
    summary={'created_utc':datetime.now(timezone.utc).isoformat(),'kind':'real public recordings and existing human annotations',
             'dataset':'SpeechOcean762','dataset_revision':manifest['revision'],
             'dev_count':len(dev),'test_count':len(test),'test_speakers':len({r['speaker'] for r in test}),
             'speaker_overlap':len({r['speaker'] for r in dev}&{r['speaker'] for r in test}),
             'phone_count':len(testphones),'expert_reference':'corpus-provided five-rater aggregate sentence accuracy × 10',
             'phone_error_definition':'human phone accuracy < 1.0 on original 0–2 scale',
             'category_definition':'reference-phone groups; all severe errors in group, not proof of exact paired substitutions',
             'asr_phone_proxy':'exact word Levenshtein alignment; word match 100, substitution/deletion 0, broadcast to phones',
             'threshold_protocol':'global per-method threshold maximizes dev phone F1; untouched official-test speaker subset',
             'g2p_protocol':'dataset canonical ARPABET mapped explicitly to IPA model tokens; no G2P accuracy claim',
             'models':{'whisper':'local faster-whisper small, CPU int8, beam_size=5',
                       'phoneme':'facebook/wav2vec2-lv-60-espeak-cv-ft, CPU float32, 4 torch threads'},
             'methods':methods,'fb_posterior_only':metrics([r['fb_posterior_only'] for r in test],[r['human_accuracy'] for r in test]),
             'source_signature':signature,'script_sha256':sha256(__file__),
             'limitations':['This evaluates acoustic scoring components, not the full application.',
              'Word-level ASR errors are only a coarse phone-error proxy.',
              'Corpus expert annotations are reused; no newly hired or international-expert claim.',
              'Fixed fusion weights are not tuned on test data.',
              'No inference of long-term learning improvement from these metrics.']}
    write_json(OUT/'speech_benchmark_results.json',summary)
    write_json(OUT/'speech_predictions.json',rows)
    with (OUT/'speech_utterance_results.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.writer(f);w.writerow(['id','split','speaker','human_accuracy',*METHODS])
        for r in rows:w.writerow([r['id'],r['split'],r['speaker'],r['human_accuracy'],*r['scores']])
    fig,ax=plt.subplots(figsize=(10,5));x=np.arange(5);width=.24
    for k,m in enumerate(methods):
        values=[m['category_f1'][g]['f1'] for g in GROUPS]
        bars=ax.bar(x+(k-1)*width,values,width,label=m['method'],color=COLORS[k])
        for b,v in zip(bars,values):ax.text(b.get_x()+width/2,v+.012,f'{v:.2f}',ha='center',fontsize=8)
    ax.set_xticks(x,[f"{g}\n错误样本={methods[0]['category_f1'][g]['positive']}" for g in GROUPS])
    ax.set(ylabel='错误检出 F1',ylim=(0,1.08));ax.legend(loc='upper right',fontsize=8)
    ax.set_title(f'公开真实录音上的目标音组错误检出（测试 {len(test)} 句）')
    fig.text(.1,-.035,'五组按参考音素划分；人工音素分 <1 判为错误。阈值只在独立开发集确定。',fontsize=9)
    save_figure(fig,'fig4_speech_f1_categories')
    fig,axes=plt.subplots(1,3,figsize=(12,4.6))
    human=np.array([r['human_accuracy'] for r in test])
    for k,(ax,m) in enumerate(zip(axes,methods)):
        pred=np.array([r['scores'][k] for r in test])
        ax.scatter(human,pred,s=13,alpha=.3,color=COLORS[k],edgecolors='none')
        ax.plot([0,100],[0,100],'--',lw=1,color='#A0A0A0')
        slope,intercept=np.polyfit(human,pred,1);xx=np.array([0,100])
        ax.plot(xx,slope*xx+intercept,color=COLORS[k],lw=1.5)
        ax.set(xlim=(0,102),ylim=(0,102),xlabel='数据集人工准确度评分 × 10',ylabel='算法分数')
        ax.set_title(m['method'],fontsize=10)
        ax.text(.04,.96,f"r={m['pearson_r']:.3f}\nρ={m['spearman_rho']:.3f}\nMAE={m['mae']:.2f}",
                transform=ax.transAxes,va='top',fontsize=9,bbox={'facecolor':'white','alpha':.85,'edgecolor':'none'})
    fig.suptitle('机器评分与五位评审者聚合标注的关系',fontsize=13)
    fig.tight_layout(rect=(0,.06,1,.92))
    fig.text(.06,.01,'实线为测试集描述性拟合，虚线为理想一致线；未用该拟合线校正评分。',fontsize=9)
    save_figure(fig,'fig5_speech_correlation')
    print(json.dumps(methods,ensure_ascii=True,indent=2),flush=True)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--limit',type=int,default=0)
    parser.add_argument('--summarize-only',action='store_true');args=parser.parse_args()
    manifest=json.loads((DATA/'manifest.json').read_text(encoding='utf-8'))
    signature=hashlib.sha256((sha256(ROOT/'speech-bridge/speech_bridge/assess.py')+
        json.dumps(IPA,sort_keys=True)+'component-protocol-v1').encode()).hexdigest()
    cache=ROOT/'.deploy-cache/benchmarks/speech_predictions'/signature[:16];cache.mkdir(parents=True,exist_ok=True)
    items=manifest['items'][:args.limit] if args.limit else manifest['items']
    missing=[r for r in items if not (cache/(r['id']+'.json')).exists()]
    if missing and args.summarize_only:raise RuntimeError(f'{len(missing)} recordings have not been inferred')
    if missing:
        import torch
        from faster_whisper import WhisperModel
        torch.set_num_threads(4)
        processor,model=assess.load_phoneme_model();blank=int(model.config.pad_token_id)
        asr=WhisperModel(str(ROOT/'.deploy-cache/speech-models/whisper/small'),device='cpu',
                         compute_type='int8',cpu_threads=4,num_workers=1,local_files_only=True)
        print(f'Models loaded; {len(missing)} uncached recordings',flush=True)
        for count,item in enumerate(missing,1):
            row=infer(item,asr,processor,blank)
            write_json(cache/(item['id']+'.json'),row)
            if count%10==0 or count==len(missing):
                print(f'inferred {count}/{len(missing)}; last={item["id"]}; sec={row["timing_ms"]["total"]/1000:.2f}',flush=True)
    if args.limit:
        print(f'Smoke run only: {len(items)} cached; final report outputs not written',flush=True);return
    rows=[json.loads((cache/(r['id']+'.json')).read_text(encoding='utf-8')) for r in items]
    assert len(rows)==len(manifest['items'])
    summarize(rows,manifest,signature)

if __name__=='__main__':main()
