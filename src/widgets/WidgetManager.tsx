import React, { createContext, useContext, useState, useRef, forwardRef } from 'react';
import { BaseWidget, BaseWidgetProps } from './BaseWidget';

interface WidgetRegistration {
  id: string;
  name: string;
  ref: React.RefObject<BaseWidget | any>;
}

interface WidgetManagerContextType {
  registerWidget: (id: string, name: string, ref: React.RefObject<BaseWidget | any>) => void;
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

  const registerWidget = (id: string, name: string, ref: React.RefObject<BaseWidget | any>) => {
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

// Updated to support both class and function components
export function withWidgetRegistration<P extends BaseWidgetProps>(
  WrappedComponent: React.ComponentType<P> | React.FC<P>,
  widgetName: string
) {
  // For class components that extend BaseWidget
  const isClassComponent = (WrappedComponent as any).prototype?.isReactComponent;
  
  if (isClassComponent) {
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
        return <WrappedComponent ref={this.widgetRef} {...this.props} />;
      }
      
      static contextType = WidgetManagerContext;
    };
  } else {
    // For function components
    return forwardRef<any, P>((props, ref) => {
      const widgetRef = useRef<any>(null);
      const managerContext = useContext(WidgetManagerContext);
      
      React.useEffect(() => {
        if (managerContext) {
          managerContext.registerWidget(props.id, widgetName, widgetRef);
        }
        
        return () => {
          if (managerContext) {
            managerContext.unregisterWidget(props.id);
          }
        };
      }, [props.id, managerContext]);
      
      return <WrappedComponent {...(props as any)} />;
    });
  }
}

// Custom hook to create a widget ref
export function useWidgetRef<T extends BaseWidget>() {
  return useRef<T>(null);
} 