import React, { createContext, useContext, useState, useRef } from 'react';
import { BaseWidget, BaseWidgetProps } from './BaseWidget';

interface WidgetRegistration {
  id: string;
  name: string;
  ref: React.RefObject<BaseWidget>;
}

interface WidgetManagerContextType {
  registerWidget: (id: string, name: string, ref: React.RefObject<BaseWidget>) => void;
  unregisterWidget: (id: string) => void;
  getWidget: (id: string) => WidgetRegistration | undefined;
  getAllWidgets: () => WidgetRegistration[];
}

const WidgetManagerContext = createContext<WidgetManagerContextType | null>(null);

export const useWidgetManager = () => {
  const context = useContext(WidgetManagerContext);
  if (!context) {
    throw new Error("useWidgetManager must be used within a WidgetManagerProvider");
  }
  return context;
};

export const WidgetManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [widgets, setWidgets] = useState<WidgetRegistration[]>([]);

  const registerWidget = (id: string, name: string, ref: React.RefObject<BaseWidget>) => {
    setWidgets(prevWidgets => {
      const existingWidgetIndex = prevWidgets.findIndex(w => w.id === id);
      if (existingWidgetIndex >= 0) {
        // Update existing widget
        const newWidgets = [...prevWidgets];
        newWidgets[existingWidgetIndex] = { id, name, ref };
        return newWidgets;
      } else {
        // Add new widget
        return [...prevWidgets, { id, name, ref }];
      }
    });
  };

  const unregisterWidget = (id: string) => {
    setWidgets(prevWidgets => prevWidgets.filter(w => w.id !== id));
  };

  const getWidget = (id: string) => {
    return widgets.find(w => w.id === id);
  };

  const getAllWidgets = () => {
    return widgets;
  };

  return (
    <WidgetManagerContext.Provider value={{ registerWidget, unregisterWidget, getWidget, getAllWidgets }}>
      {children}
    </WidgetManagerContext.Provider>
  );
};

export function withWidgetRegistration<P extends BaseWidgetProps>(
  WrappedWidget: new (props: P) => BaseWidget<P>,
  widgetName: string
) {
  return class WithRegistration extends React.Component<P> {
    private widgetRef = React.createRef<BaseWidget>();
    
    componentDidMount() {
      const context = this.context as WidgetManagerContextType;
      if (context) {
        context.registerWidget(this.props.id, widgetName, this.widgetRef);
      }
    }
    
    componentWillUnmount() {
      const context = this.context as WidgetManagerContextType;
      if (context) {
        context.unregisterWidget(this.props.id);
      }
    }
    
    render() {
      return <WrappedWidget ref={this.widgetRef} {...this.props} />;
    }
    
    static contextType = WidgetManagerContext;
  };
}

// Custom hook to create a widget ref
export function useWidgetRef<T extends BaseWidget>() {
  return useRef<T>(null);
} 