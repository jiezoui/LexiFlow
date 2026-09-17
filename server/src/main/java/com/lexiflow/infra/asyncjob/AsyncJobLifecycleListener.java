package com.lexiflow.infra.asyncjob;

import com.lexiflow.infra.asyncjob.vo.AsyncJobVo;

public interface AsyncJobLifecycleListener {

    void onJobChanged(AsyncJobVo job);
}
