import { Component, Suspense, type ErrorInfo, type ReactNode } from 'react';
import { reportModuleCrash, type ModuleId } from './registry';

interface ModuleBoundaryProps {
  id: ModuleId;
  /** Название раздела для человека: «Добавить локацию», «Заказать пандус». */
  title: string;
  children: ReactNode;
  /** Основа закрывает экран модуля и возвращает человека на карту. */
  onDismiss?: () => void;
}

interface ModuleBoundaryState {
  failed: boolean;
  dismissed: boolean;
}

/**
 * Граница модуля. Ошибка внутри модуля (в отрисовке или при загрузке его кода)
 * остаётся здесь: вместо модуля короткая строка, карта под ней работает.
 */
export class ModuleBoundary extends Component<ModuleBoundaryProps, ModuleBoundaryState> {
  state: ModuleBoundaryState = { failed: false, dismissed: false };

  static getDerivedStateFromError(): Partial<ModuleBoundaryState> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportModuleCrash(this.props.id);
    console.error(`[modules] «${this.props.id}» упал`, error, info.componentStack);
  }

  private dismiss = () => {
    // Упавший модуль заново не рисуем: строку убираем, основа сама закроет его экран.
    this.setState({ dismissed: true });
    this.props.onDismiss?.();
  };

  render() {
    if (this.state.failed && this.state.dismissed) return null;
    if (this.state.failed) {
      return (
        <div className="module-down" role="alert">
          <span>Раздел «{this.props.title}» временно недоступен. Карта работает.</span>
          <button type="button" className="module-down-close" onClick={this.dismiss}>
            Закрыть
          </button>
        </div>
      );
    }
    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}
