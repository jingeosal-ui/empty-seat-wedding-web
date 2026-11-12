# 출처와 이용 조건

## MediaPipe

- 패키지: Google `@mediapipe/tasks-vision` 1.2.3, npm 메타데이터의 Apache-2.0. 원문 `mediapipe-APACHE-2.0.txt` 동봉.
- 저장소: https://github.com/google-ai-edge/mediapipe
- 공식 Web 설명: https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Web
- Face 설명: https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web
- Pose Lite / Face task 원본 URL·크기·SHA-256: `models-and-vendor.json`
- Pose 모델 카드: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf (Apache License 2.0 명시)
- Face Mesh V2 모델 카드: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20MediaPipe%20Face%20Mesh%20V2.pdf (Apache License 2.0 명시)

다운로드된 모델은 수정하지 않았습니다. 런타임 번들은 npm 공식 배포에서 복사합니다. 이 프로젝트에 사용한 배포 파일의 출처·버전을 남기며 제3자 에셋을 프로젝트 자체 제작물로 표시하지 않습니다.

## 승인 캐릭터

사용자가 2026-11-12 승인·제공한 손각시/몽달귀신 의례물형 캐릭터 시트입니다. 원본은 `sources/approved`에 보존합니다. `public/assets/characters/manifest.json`에 원본·전신 SHA-256과 추출 영역을 기록합니다. 사용자가 제공한 생성 이미지이며 퍼블릭 도메인/CC0로 재허가하지 않습니다. 캐릭터의 권리와 외부 배포 범위는 제공자의 권한을 따릅니다. 이번 비공개 프로젝트와 로컬 전시 용도에만 포함했습니다.

## 자체 제작

전시 코드, 별도 종이 가리개 패턴, 설정 화면, 검증 스크립트를 이 프로젝트에서 작성했습니다. 종이 패턴은 결정적 난수로 생성한 단순 질감이며 외부 사진이 아닙니다. 개발용 Sharp는 Apache-2.0, 그 하위 이미지 라이브러리는 npm 패키지 내 각각의 라이선스를 따릅니다. 배포 실행에는 Sharp/node_modules가 필요 없습니다.

## 설치 없는 버전의 Node

Node.js v26.13.1의 공식 Windows x64 실행 파일을 재배포합니다. 출처·고정 SHA-256은 `node-runtime.json`에 기록하며 배포본의 `runtime/node-win-x64/LICENSE.txt`에 해당 버전의 Node 및 제3자 구성 요소 라이선스를 전부 포함합니다. npm/설치 프로그램은 포함하지 않습니다. 공식 SHASUMS256과 실행 파일의 일치를 확인했고 이 PC에서 Authenticode 서명 Valid / OpenJS Foundation을 확인했습니다. Chrome은 동봉하지 않으며 별도 설치된 브라우저를 사용합니다.
