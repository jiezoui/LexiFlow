"""语音桥接服务入口：``python -m speech_bridge``。

日志说明
--------
服务常以「分离进程」方式启动（见 ``scripts/start-speech-bridge.ps1``）。
Windows 下父进程一旦持有子进程的输出句柄就会一直等待其关闭，导致自动化
调用「服务已就绪但命令不返回」；因此启动脚本**不重定向**子进程输出，
改由本模块自己把日志写到文件（``--log-file`` / ``--error-log-file``）。
"""

from __future__ import annotations

import argparse
import logging
import sys

from . import config


def main() -> int:
    parser = argparse.ArgumentParser(description="LexiFlow 影子跟读语音桥接服务")
    parser.add_argument("--host", default=config.HOST)
    parser.add_argument("--port", type=int, default=config.PORT)
    parser.add_argument("--reload", action="store_true", help="开发模式：代码变更自动重启")
    parser.add_argument("--log-level", default="info")
    parser.add_argument("--log-file", default=None, help="访问/应用日志写入的文件")
    parser.add_argument("--error-log-file", default=None, help="错误日志写入的文件")
    args = parser.parse_args()

    config.ensure_dirs()

    # uvicorn 的 log_config=None 会保留我们已配置的 root logger；
    # 这里为「服务自身日志」与「uvicorn 访问日志」分别挂文件 handler。
    if args.log_file:
        from logging.handlers import RotatingFileHandler

        handler = RotatingFileHandler(
            args.log_file, maxBytes=8 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(name)s | %(message)s")
        )
        logging.getLogger().addHandler(handler)
        for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
            logging.getLogger(name).addHandler(handler)

    err_handler = None
    if args.error_log_file:
        from logging.handlers import RotatingFileHandler

        err_handler = RotatingFileHandler(
            args.error_log_file, maxBytes=4 * 1024 * 1024, backupCount=2, encoding="utf-8"
        )
        err_handler.setLevel(logging.WARNING)
        err_handler.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)-7s %(name)s | %(message)s")
        )
        logging.getLogger().addHandler(err_handler)
        for name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
            logging.getLogger(name).addHandler(err_handler)

    logging.getLogger("speech-bridge").info(
        "启动语音桥接服务 http://%s:%d (docs: /docs)", args.host, args.port
    )

    import uvicorn

    uvicorn.run(
        "speech_bridge.app:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level,
        # 单机 CPU 推理：限制并发，避免内存峰值与线程争抢
        limit_concurrency=8,
        timeout_keep_alive=75,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
