package com.lexiflow.modules.stats.vo;

import lombok.Data;

import java.time.LocalDate;

/**
 * 按自然日聚合的计数行，供热力图按天归并各来源活动量使用。
 */
@Data
public class DailyCountRow {

    private LocalDate statDate;

    private Integer total;
}
