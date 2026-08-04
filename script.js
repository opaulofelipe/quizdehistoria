"use strict";

const STORAGE_KEY = "quiz-historia-progresso-v2";
const STORAGE_VERSION = 2;

const elements = {
  questionArea: document.querySelector("#question-area"),
  resultArea: document.querySelector("#result-area"),
  questionText: document.querySelector("#question-text"),
  optionsList: document.querySelector("#options-list"),
  questionCounter: document.querySelector("#question-counter"),
  progressPercentage: document.querySelector("#progress-percentage"),
  progressBar: document.querySelector("#progress-bar"),
  progressFill: document.querySelector("#progress-fill"),
  score: document.querySelector("#score"),
  explanationBox: document.querySelector("#explanation-box"),
  explanationText: document.querySelector("#explanation-text"),
  nextButton: document.querySelector("#next-button"),
  finalScore: document.querySelector("#final-score"),
  totalQuestions: document.querySelector("#total-questions"),
  resultMessage: document.querySelector("#result-message"),
  restartButton: document.querySelector("#restart-button"),
  errorMessage: document.querySelector("#error-message"),
  errorDialog: document.querySelector("#error-dialog"),
  closeDialogButton: document.querySelector("#close-dialog-button")
};

const state = {
  allQuestions: [],
  questions: [],
  currentQuestionIndex: 0,
  score: 0,
  answered: false,
  selectedIndex: null,
  completed: false,
  storageEnabled: true
};

const optionLetters = ["A", "B", "C", "D"];

async function loadQuestions() {
  try {
    const response = await fetch("./questions.json");

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    const questions = await response.json();

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("O arquivo de perguntas está vazio ou é inválido.");
    }

    validateQuestions(questions);

    state.allQuestions = questions;
    elements.totalQuestions.textContent = String(questions.length);

    restoreOrCreateProgress();
    elements.score.textContent = String(state.score);

    if (state.completed) {
      showResults();
    } else {
      renderQuestion();
    }
  } catch (error) {
    console.error("Erro ao carregar as perguntas:", error);
    elements.questionArea.hidden = true;
    elements.errorMessage.hidden = false;
  }
}

function validateQuestions(questions) {
  const ids = new Set();

  questions.forEach((question, index) => {
    const hasValidId =
      typeof question.id === "string" &&
      question.id.trim().length > 0 &&
      !ids.has(question.id);

    const hasValidOptions =
      Array.isArray(question.options) &&
      question.options.length === 4 &&
      question.options.every((option) => typeof option === "string");

    const hasValidAnswer =
      Number.isInteger(question.correctIndex) &&
      question.correctIndex >= 0 &&
      question.correctIndex <= 3;

    const hasValidTexts =
      typeof question.question === "string" &&
      typeof question.explanation === "string";

    if (!hasValidId || !hasValidOptions || !hasValidAnswer || !hasValidTexts) {
      throw new Error(`A pergunta ${index + 1} possui dados inválidos.`);
    }

    ids.add(question.id);
  });
}

function restoreOrCreateProgress() {
  const savedProgress = readProgress();

  if (isValidSavedProgress(savedProgress)) {
    applySavedProgress(savedProgress);
    return;
  }

  startNewCycle();
}

function isValidSavedProgress(progress) {
  if (!progress || progress.version !== STORAGE_VERSION) {
    return false;
  }

  const availableIds = new Set(
    state.allQuestions.map((question) => question.id)
  );

  const hasValidOrder =
    Array.isArray(progress.questionOrder) &&
    progress.questionOrder.length === state.allQuestions.length &&
    new Set(progress.questionOrder).size === progress.questionOrder.length &&
    progress.questionOrder.every((id) => availableIds.has(id));

  const hasValidIndex =
    Number.isInteger(progress.currentQuestionIndex) &&
    progress.currentQuestionIndex >= 0 &&
    progress.currentQuestionIndex < state.allQuestions.length;

  const hasValidScore =
    Number.isInteger(progress.score) &&
    progress.score >= 0 &&
    progress.score <= state.allQuestions.length;

  const hasValidSelectedIndex =
    progress.selectedIndex === null ||
    (
      Number.isInteger(progress.selectedIndex) &&
      progress.selectedIndex >= 0 &&
      progress.selectedIndex <= 3
    );

  return (
    hasValidOrder &&
    hasValidIndex &&
    hasValidScore &&
    typeof progress.answered === "boolean" &&
    hasValidSelectedIndex &&
    typeof progress.completed === "boolean"
  );
}

function applySavedProgress(progress) {
  const questionsById = new Map(
    state.allQuestions.map((question) => [question.id, question])
  );

  state.questions = progress.questionOrder.map((id) => questionsById.get(id));
  state.currentQuestionIndex = progress.currentQuestionIndex;
  state.score = progress.score;
  state.answered = progress.answered;
  state.selectedIndex = progress.selectedIndex;
  state.completed = progress.completed;
}

function startNewCycle() {
  state.questions = shuffleArray([...state.allQuestions]);
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.answered = false;
  state.selectedIndex = null;
  state.completed = false;

  saveProgress();
}

function shuffleArray(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }

  return items;
}

function readProgress() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (!storedValue) {
      return null;
    }

    return JSON.parse(storedValue);
  } catch (error) {
    console.warn("Não foi possível ler o progresso salvo:", error);
    state.storageEnabled = false;
    return null;
  }
}

function saveProgress() {
  if (!state.storageEnabled || state.questions.length === 0) {
    return;
  }

  const progress = {
    version: STORAGE_VERSION,
    questionOrder: state.questions.map((question) => question.id),
    currentQuestionIndex: state.currentQuestionIndex,
    score: state.score,
    answered: state.answered,
    selectedIndex: state.selectedIndex,
    completed: state.completed,
    savedAt: new Date().toISOString()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn("Não foi possível salvar o progresso:", error);
    state.storageEnabled = false;
  }
}

function renderQuestion() {
  const currentQuestion = state.questions[state.currentQuestionIndex];

  elements.questionArea.hidden = false;
  elements.resultArea.hidden = true;
  elements.explanationBox.hidden = true;
  elements.nextButton.hidden = true;
  elements.optionsList.replaceChildren();

  elements.questionText.textContent = currentQuestion.question;

  updateProgress();

  currentQuestion.options.forEach((option, index) => {
    const optionButton = createOptionButton(option, index);
    elements.optionsList.append(optionButton);
  });

  if (state.answered && state.selectedIndex !== null) {
    restoreAnsweredQuestion();
  }
}

function createOptionButton(optionText, optionIndex) {
  const button = document.createElement("button");
  button.className = "option-button";
  button.type = "button";
  button.dataset.optionIndex = String(optionIndex);

  const letter = document.createElement("span");
  letter.className = "option-letter";
  letter.textContent = optionLetters[optionIndex];
  letter.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "option-text";
  text.textContent = optionText;

  const status = document.createElement("span");
  status.className = "option-status";
  status.setAttribute("aria-hidden", "true");

  button.append(letter, text, status);

  button.addEventListener("click", () => {
    selectAnswer(optionIndex);
  });

  return button;
}

function selectAnswer(selectedIndex) {
  if (state.answered) {
    return;
  }

  const currentQuestion = state.questions[state.currentQuestionIndex];
  const isCorrect = selectedIndex === currentQuestion.correctIndex;

  state.answered = true;
  state.selectedIndex = selectedIndex;

  if (isCorrect) {
    state.score += 1;
    elements.score.textContent = String(state.score);
  }

  paintAnswerState(selectedIndex);
  showExplanation(currentQuestion.explanation);
  prepareNextButton();
  updateProgress();
  saveProgress();

  if (!isCorrect) {
    openErrorDialog();
  }
}

function restoreAnsweredQuestion() {
  const currentQuestion = state.questions[state.currentQuestionIndex];

  paintAnswerState(state.selectedIndex);
  showExplanation(currentQuestion.explanation);
  prepareNextButton();
}

function paintAnswerState(selectedIndex) {
  const currentQuestion = state.questions[state.currentQuestionIndex];
  const optionButtons = [
    ...elements.optionsList.querySelectorAll(".option-button")
  ];

  optionButtons.forEach((button, index) => {
    button.disabled = true;

    const status = button.querySelector(".option-status");

    if (index === currentQuestion.correctIndex) {
      button.classList.add("correct");
      status.textContent = "✓";
      button.setAttribute(
        "aria-label",
        `${button.innerText}. Resposta correta.`
      );
      return;
    }

    if (index === selectedIndex) {
      button.classList.add("incorrect");
      status.textContent = "×";
      button.setAttribute(
        "aria-label",
        `${button.innerText}. Resposta incorreta.`
      );
      return;
    }

    button.classList.add("dimmed");
  });
}

function showExplanation(explanation) {
  elements.explanationText.textContent = explanation;
  elements.explanationBox.hidden = false;
}

function prepareNextButton() {
  const isLastQuestion =
    state.currentQuestionIndex === state.questions.length - 1;

  elements.nextButton.replaceChildren();

  const label = document.createTextNode(
    isLastQuestion ? "Ver resultado" : "Próxima pergunta"
  );

  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = isLastQuestion ? "✓" : "→";

  elements.nextButton.append(label, arrow);
  elements.nextButton.hidden = false;
}

function updateProgress() {
  const currentNumber = state.currentQuestionIndex + 1;
  const totalQuestions = state.questions.length;
  const answeredQuestions =
    state.currentQuestionIndex + (state.answered ? 1 : 0);
  const progress = Math.round(
    (answeredQuestions / totalQuestions) * 100
  );

  elements.questionCounter.textContent =
    `Pergunta ${currentNumber} de ${totalQuestions}`;

  elements.progressPercentage.textContent = `${progress}%`;
  elements.progressFill.style.width = `${progress}%`;
  elements.progressBar.setAttribute("aria-valuenow", String(progress));
}

function goToNextQuestion() {
  if (!state.answered) {
    return;
  }

  const isLastQuestion =
    state.currentQuestionIndex === state.questions.length - 1;

  if (isLastQuestion) {
    state.completed = true;
    saveProgress();
    showResults();
    return;
  }

  state.currentQuestionIndex += 1;
  state.answered = false;
  state.selectedIndex = null;

  saveProgress();
  renderQuestion();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showResults() {
  const totalQuestions = state.questions.length;
  const percentage = Math.round((state.score / totalQuestions) * 100);

  elements.questionArea.hidden = true;
  elements.resultArea.hidden = false;
  elements.finalScore.textContent = String(state.score);
  elements.score.textContent = String(state.score);

  elements.progressPercentage.textContent = "100%";
  elements.progressFill.style.width = "100%";
  elements.progressBar.setAttribute("aria-valuenow", "100");

  elements.resultMessage.textContent = getResultMessage(percentage);
}

function getResultMessage(percentage) {
  if (percentage === 100) {
    return "Excelente! Você demonstrou um ótimo domínio dos temas históricos apresentados.";
  }

  if (percentage >= 75) {
    return "Muito bem! Você compreendeu a maior parte dos assuntos e está construindo uma base histórica sólida.";
  }

  if (percentage >= 50) {
    return "Bom resultado! Reveja as explicações para fortalecer os pontos que ainda causaram dúvida.";
  }

  return "Continue estudando. Errar também faz parte da aprendizagem, especialmente quando entendemos por que uma resposta está incorreta.";
}

function restartQuiz() {
  startNewCycle();
  elements.score.textContent = "0";

  renderQuestion();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function openErrorDialog() {
  if (typeof elements.errorDialog.showModal === "function") {
    elements.errorDialog.showModal();
    elements.closeDialogButton.focus();
    return;
  }

  alert("Você errou!");
}

function closeErrorDialog() {
  if (elements.errorDialog.open) {
    elements.errorDialog.close();
  }

  elements.explanationBox.scrollIntoView({
    behavior: "smooth",
    block: "nearest"
  });
}

elements.nextButton.addEventListener("click", goToNextQuestion);
elements.restartButton.addEventListener("click", restartQuiz);
elements.closeDialogButton.addEventListener("click", closeErrorDialog);

elements.errorDialog.addEventListener("click", (event) => {
  const dialogRectangle = elements.errorDialog.getBoundingClientRect();

  const clickedOutside =
    event.clientX < dialogRectangle.left ||
    event.clientX > dialogRectangle.right ||
    event.clientY < dialogRectangle.top ||
    event.clientY > dialogRectangle.bottom;

  if (clickedOutside) {
    closeErrorDialog();
  }
});

document.addEventListener("keydown", (event) => {
  if (elements.errorDialog.open || state.answered || state.completed) {
    return;
  }

  const pressedNumber = Number(event.key);

  if (pressedNumber >= 1 && pressedNumber <= 4) {
    const optionButton = elements.optionsList.querySelector(
      `[data-option-index="${pressedNumber - 1}"]`
    );

    optionButton?.click();
  }
});

loadQuestions();
