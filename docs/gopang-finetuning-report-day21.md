# GOPANG EXAONE Fine-tuning 결과 보고서

**작성일**: 2026-01-24  
**프로젝트**: GOPANG AI 시스템  
**작성자**: Day 21 세션  

---

## 1. 개요

### 1.1 목표
- EXAONE 7.8B 모델을 GOPANG 전용 응답 형식으로 Fine-tuning
- EC2 서버에 배포하여 실제 서비스에 적용

### 1.2 결과 요약

| 항목 | 결과 |
|------|------|
| Fine-tuning | ✅ 성공 |
| 모델 변환 (GGUF) | ✅ 성공 |
| EC2 배포 | ✅ 성공 |
| GOPANG 형식 응답 | ⚠️ 긴 시스템 프롬프트 필요 |
| 응답 속도 | ⚠️ CPU 기반으로 느림 (1-2분) |

---

## 2. Fine-tuning 과정

### 2.1 환경
- **플랫폼**: Google Colab Pro
- **GPU**: A100 80GB
- **학습 시간**: 약 4시간 32분

### 2.2 데이터셋

| 파일 | 샘플 수 | 위치 |
|------|---------|------|
| train.jsonl | 14,014 | Google Drive |
| validation.jsonl | 779 | Google Drive |

### 2.3 학습 설정
```python
# LoRA 설정
LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM"
)

# 학습 설정 (trl 0.27.0)
SFTConfig(
    num_train_epochs=3,
    per_device_train_batch_size=2,
    gradient_accumulation_steps=4,
    learning_rate=2e-5,
    max_length=2048,  # trl 0.27.0: max_seq_length → max_length
    bf16=True
)

# SFTTrainer (trl 0.27.0)
SFTTrainer(
    processing_class=tokenizer,  # tokenizer → processing_class
)
```

### 2.4 학습 결과

| 지표 | 시작 | 최종 | 개선 |
|------|------|------|------|
| **Loss** | 3.82 | 0.29 | ⬇️ 92% 감소 |
| **Accuracy** | 44% | 93.4% | ⬆️ +49% |
| **Eval Loss** | 3.57 | 0.30 | ⬇️ 92% 감소 |

### 2.5 trl 0.27.0 API 변경사항 (중요!)

| 이전 버전 | trl 0.27.0 |
|----------|------------|
| max_seq_length | max_length |
| tokenizer= | processing_class= |

---

## 3. 모델 변환

### 3.1 EXAONE 양자화 문제 해결

**문제**: `key not found: exaone.attention.layer_norm_rms_epsilon`

**해결**: convert_hf_to_gguf.py 수정
```python
# ExaoneModel 클래스에 추가
self.gguf_writer.add_layer_norm_rms_eps(hparams["layer_norm_epsilon"])
```

### 3.2 최종 파일

| 파일 | 크기 | 용도 |
|------|------|------|
| gopang-exaone-finetuned-v1/ | 18MB | LoRA 어댑터 |
| gopang-exaone-finetuned-f16-v2.gguf | 15GB | F16 백업 |
| **gopang-exaone-finetuned-Q4_K_M.gguf** | **4.5GB** | **EC2 배포용** |

---

## 4. 응답 속도 분석

### 4.1 현재 성능 (CPU, t3.large)

| 프롬프트 크기 | 응답 토큰 | 소요 시간 |
|--------------|----------|----------|
| 27 토큰 | 46 토큰 | ~35초 |
| 53 토큰 | 100 토큰 | ~65초 |
| 185 토큰 | 136 토큰 | ~130초 |

### 4.2 속도 개선 방안

| 옵션 | 예상 속도 | 비용 |
|------|----------|------|
| g4dn.xlarge (T4 GPU) | 3~5초 | $0.526/시간 |
| g5.xlarge (A10G GPU) | 2~3초 | $1.006/시간 |
| EXAONE 2.4B | 20~30초 | 현재 비용 유지 |
| DeepSeek API | 1~3초 | 토큰당 과금 |

---

## 5. GOPANG 형식 응답 조건

긴 시스템 프롬프트 필요:
```
당신은 GOPANG 중개 AI입니다.
호출 가능: 경찰청_AI, 법원_AI, 주민센터_AI...
응답 형식:
[사용자위치: 지역]
[Vault 접근] 전문기관_AI 호출
🤖 전문기관_AI: [업무 처리 결과]
```

---

## 6. 파일 위치

### Google Drive
```
gopang_exaone_dataset_v4/  (학습 데이터)
gopang-exaone-finetuned-v1/  (LoRA)
gopang-exaone-merged/  (병합 모델)
gopang-exaone-finetuned-Q4_K_M.gguf  (양자화)
```

### EC2
```
/gopang/ai-engine/models/gopang-exaone-finetuned-Q4_K_M.gguf
```

---

## 7. 참고 명령어
```bash
# EC2 접속
ssh -i "gopang-dev-key.pem" -p 2222 ubuntu@13.222.8.230

# 서비스 관리
sudo systemctl status llama-server gopang-ai gopang-backend
sudo systemctl restart llama-server

# 테스트
curl http://localhost:8000/health
```

---

**문서 버전**: 1.0  
**최종 수정**: 2026-01-24
